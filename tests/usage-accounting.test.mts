import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSumopodChatRequest} from '../lib/sumopod.ts';
import {createOrchestrator} from '../lib/ai/orchestration.ts';
import {validateChat} from '../lib/ai/context.ts';
import {resetProviderHealth} from '../lib/ai/provider-health.ts';

const verified=['gpt-4o-mini','gpt-5.4-mini','deepseek-v4-flash'];
const requestBody=(modelId:string,stream=true)=>JSON.parse(buildSumopodChatRequest({
 apiKey:'LOCAL_USAGE_FIXTURE',modelId,stream,maxTokens:64,
 systemInstruction:'Follow the requested format.',messages:[{role:'user',content:'Tulis selesai.'}],
}).init.body);

test('verified streaming families request usage while preserving their output-limit parameter',()=>{
 for(const id of verified){
  const body=requestBody(id);
  assert.deepEqual(body.stream_options,{include_usage:true});
  assert.equal(body[id.startsWith('gpt-5')?'max_completion_tokens':'max_tokens'],64);
  assert.equal(body[id.startsWith('gpt-5')?'max_tokens':'max_completion_tokens'],undefined);
 }
});
test('non-streaming requests and unverified model IDs omit streaming usage options',()=>{
 for(const id of verified)assert.equal(requestBody(id,false).stream_options,undefined);
 for(const id of ['gpt-4.1-mini','claude-haiku-4-5','deepseek-v4-pro'])assert.equal(requestBody(id).stream_options,undefined);
 const otherGateway=JSON.parse(buildSumopodChatRequest({apiKey:'LOCAL_USAGE_FIXTURE',baseUrl:'https://example.com/v1',modelId:'gpt-4o-mini',systemInstruction:'Rules',messages:[{role:'user',content:'selesai'}]}).init.body);
 assert.equal(otherGateway.stream_options,undefined);
});

async function withEnvironment(run:()=>Promise<void>){
 const previous={...process.env};
 Object.assign(process.env,{SUMOPOD_API_KEY:'LOCAL_USAGE_FIXTURE',SUMOPOD_BASE_URL:'https://ai.sumopod.com/v1',ENABLE_FRONTIER:'false',
  AET_ROUTING_MODE:'off',AET_ROUTING_POLICY_FILE:'',AET_RUNTIME_PRICING_FILE:'',AET_MAX_REQUEST_USD:'',AET_CHAT_DEADLINE_MS:''});
 resetProviderHealth();
 try{await run();}finally{
  resetProviderHealth();
  for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];
  Object.assign(process.env,previous);
 }
}

for(const modelId of verified)test('production orchestration captures conditional trailing usage and costs for '+modelId,async()=>{
 await withEnvironment(async()=>{
  let calls=0;
  const input=validateChat({mode:'daily',responseMode:'fast',messages:[{id:'usage-'+modelId,role:'user',content:'Tulis hanya kata selesai.'}]});
  const session=await createOrchestrator(input,{
   signal:new AbortController().signal,evaluationCandidate:modelId,
   rates:{[modelId]:{inputUsdPerMillion:1,outputUsdPerMillion:2}},
   fetcher:async(_url,init)=>{
    calls++;
    const body=JSON.parse(String(init?.body));
    assert.equal(body.model,modelId);
    // Mimic the observed gateway: usage is absent unless explicitly requested.
    const usage=body.stream_options?.include_usage
     ?'data: '+JSON.stringify({choices:[],usage:{prompt_tokens:12,completion_tokens:3,total_tokens:15}})+'\n\n':'';
    return new Response('data: '+JSON.stringify({model:modelId,choices:[{delta:{content:'selesai'},finish_reason:'stop'}]})+'\n\n'
     +usage+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
   },
  });
  const result=await session.run(()=>{});
  assert.equal(calls,1);assert.equal(result.answer,'selesai');
  assert.deepEqual(result.telemetry.usage,{inputTokens:12,outputTokens:3});
  assert.deepEqual(result.telemetry.attempts[0].usage,{prompt_tokens:12,completion_tokens:3,total_tokens:15});
  assert.ok(Math.abs(result.telemetry.usageBasedCostUsd!-.000018)<1e-12);
  assert.equal(result.telemetry.actualBilledCostUsd,null);
  assert.equal(result.telemetry.attempts[0].reportedModel,modelId);
 });
});

test('a provider omitting requested usage still produces unknown cost rather than fabricated zero',async()=>{
 await withEnvironment(async()=>{
  const input=validateChat({mode:'daily',responseMode:'fast',messages:[{id:'missing-usage',role:'user',content:'Tulis hanya kata selesai.'}]});
  const session=await createOrchestrator(input,{
   signal:new AbortController().signal,rates:{'gpt-4o-mini':{inputUsdPerMillion:1,outputUsdPerMillion:2}},
   fetcher:async()=>new Response('data: '+JSON.stringify({model:'gpt-4o-mini',choices:[{delta:{content:'selesai'},finish_reason:'stop'}]})
    +'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}}),
  });
  const result=await session.run(()=>{});
  assert.equal(result.telemetry.usage,null);assert.equal(result.telemetry.usageBasedCostUsd,null);assert.equal(result.telemetry.actualBilledCostUsd,null);
 });
});
