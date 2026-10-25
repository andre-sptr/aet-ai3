import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {inspectUsageStream,runUsageProbe} from '../scripts/stream-usage-probe.mjs';

// Synthetic local guard fixtures. No real provider or human verification is asserted.
async function fixture(cap=3) {
 const directory=await fs.mkdtemp(path.join(tmpdir(),'aet-usage-probe-'));
 const key='LOCAL_PROBE_FIXTURE_NO_SECRET';
 const budget=path.join(directory,'budget.json'),pricing=path.join(directory,'pricing.json');
 await fs.writeFile(budget,JSON.stringify({strategy:'provider-enforced-key-cap',operatorVerified:true,dedicatedKey:true,currency:'USD',hardLimitUsd:cap,
  verifiedAt:new Date(Date.now()-1000).toISOString(),evidence:'SYNTHETIC LOCAL TEST ONLY; no real provider spending cap.',
  keySha256:createHash('sha256').update(key).digest('hex'),providerBaseUrl:'https://ai.sumopod.com/v1'}));
 await fs.writeFile(pricing,JSON.stringify({operatorVerified:true,verifiedAt:new Date(Date.now()-1000).toISOString(),sourceUrl:'https://sumopod.com/ai',
  models:{'gpt-4o-mini':{inputUsdPerMillion:1,outputUsdPerMillion:2}}}));
 return {key,env:{SUMOPOD_API_KEY:key,AET_LIVE_TEST_APPROVED:'true',AET_TEST_BUDGET_USD:'3',AET_BENCHMARK_BUDGET_FILE:budget,AET_BENCHMARK_PRICING_FILE:pricing},
  cleanup:()=>fs.rm(directory,{recursive:true,force:true})};
}
function stream(usage=false,model='gpt-4o-mini') {
 return 'data: '+JSON.stringify({model,choices:[{delta:{content:'AET OK',reasoning_content:'PRIVATE_NOT_FOR_REPORT'},finish_reason:'stop'}]})+'\n\n'
  +(usage?'data: '+JSON.stringify({choices:[],usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12}})+'\n\n':'')+'data: [DONE]\n\n';
}
const response=(usage=false)=>new Response(stream(usage),{headers:{'Content-Type':'text/event-stream'}});

test('default usage diagnostic is a zero-network plan with exactly two bounded variants',async()=>{
 let calls=0;
 const report=await runUsageProbe({env:{},fetcher:async()=>{calls++;throw new Error('No fetch permitted.');}});
 assert.equal(calls,0);assert.equal(report.modelRequests,0);assert.equal(report.status,'PLAN_ONLY');assert.equal(report.productionCalibrationEvidence,false);
 assert.equal(report.results.length,2);assert.equal(report.results[0].requestBody.max_tokens,64);
 assert.equal(report.results[0].requestBody.stream_options,undefined);assert.deepEqual(report.results[1].requestBody.stream_options,{include_usage:true});
});
test('usage diagnostic rejects unknown and Frontier models before networking',async()=>{
 for(const modelId of ['retired-id','gpt-5.4'])await assert.rejects(()=>runUsageProbe({live:true,modelId,env:{},fetcher:async()=>{throw new Error('No fetch.');}}),/supported public/);
});
test('valid local guard without explicit live flag authorization stays blocked',async()=>{
 const f=await fixture();try{
  const report=await runUsageProbe({live:true,env:{...f.env,AET_LIVE_TEST_APPROVED:'false'},fetcher:async()=>{assert.fail('No fetch allowed.');}});
  assert.equal(report.status,'BLOCKED');assert.equal(report.modelRequests,0);
 }finally{await f.cleanup();}
});
test('two controlled attempts capture trailing usage through the production parser and persist dispatch first',async()=>{
 const f=await fixture();try{
  const dispatched:number[]=[];let calls=0;
  const report=await runUsageProbe({live:true,env:f.env,checkpoint:async r=>{if(r.results.some(s=>s.status==='DISPATCHING'))dispatched.push(r.modelRequests);},
   fetcher:async(_url,init)=>{const body=JSON.parse(String(init?.body));calls++;assert.ok(dispatched.includes(calls));return response(Boolean(body.stream_options?.include_usage));}});
  assert.equal(calls,2);assert.equal(report.modelRequests,2);assert.equal(report.diagnosis,'USAGE_CAPTURED_WITH_INCLUDE_USAGE');
  assert.equal(report.results[0].parserUsage,null);assert.equal(report.results[1].parserUsage.total_tokens,12);
  assert.equal(report.results[1].wireUsageObjects,1);assert.equal(report.results[1].usageBasedCostUsd,.000014);
  assert.equal(report.actualBilledCostUsd,null);assert.doesNotMatch(JSON.stringify(report),/PRIVATE_NOT_FOR_REPORT|LOCAL_PROBE_FIXTURE_NO_SECRET|Bearer |Authorization/);
 }finally{await f.cleanup();}
});
test('authentication failure stops the second variant without retries or model rotation',async()=>{
 const f=await fixture();try{let calls=0;
  const report=await runUsageProbe({live:true,env:f.env,fetcher:async()=>{calls++;return new Response('not stored',{status:401});}});
  assert.equal(calls,1);assert.equal(report.modelRequests,1);assert.equal(report.results[1].status,'BLOCKED');
 }finally{await f.cleanup();}
});
test('an accepted usage option with missing fields keeps usage and cost unknown',async()=>{
 const f=await fixture();try{
  const report=await runUsageProbe({live:true,env:f.env,fetcher:async()=>response(false)});
  assert.equal(report.diagnosis,'NO_COMPLETE_USAGE_IN_EXPECTED_FIELDS');
  assert.ok(report.results.every(r=>r.parserUsage===null&&r.usageBasedCostUsd===null));
 }finally{await f.cleanup();}
});
test('usage observed after DONE is distinguished from usage captured by the production parser',async()=>{
 const raw=stream(false)+'data: '+JSON.stringify({choices:[],usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12}})+'\n\n';
 const inspection=await inspectUsageStream(raw,'gpt-4o-mini');
 assert.equal(inspection.wireUsage.length,1);assert.equal(inspection.parserUsage,null);
});
test('a verified cap too small to reserve an attempt blocks all networking',async()=>{
 const f=await fixture(.00000001);try{
  const report=await runUsageProbe({live:true,env:f.env,fetcher:async()=>{assert.fail('No fetch allowed.');}});
  assert.equal(report.modelRequests,0);assert.equal(report.status,'BLOCKED');
 }finally{await f.cleanup();}
});
test('a failed pre-dispatch checkpoint prevents any potentially billed request',async()=>{
 const f=await fixture();try{let calls=0;
  await assert.rejects(()=>runUsageProbe({live:true,env:f.env,checkpoint:async r=>{if(r.modelRequests)throw new Error('Checkpoint failed.');},
   fetcher:async()=>{calls++;return response(true);}}),/Checkpoint failed/);
  assert.equal(calls,0);
 }finally{await f.cleanup();}
});
