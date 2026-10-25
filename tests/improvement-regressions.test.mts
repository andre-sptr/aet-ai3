import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildSumopodChatRequest, parseOpenAITextStream, StreamFailure, type StreamMetadata } from '../lib/sumopod.ts';
import { createOrchestrator, type OrchestrationEvent } from '../lib/ai/orchestration.ts';
import { validateChat } from '../lib/ai/context.ts';
import { resetProviderHealth } from '../lib/ai/provider-health.ts';
import { outputContract, checkOutputContract } from '../lib/ai/output-contract.ts';
import { contextualToolCalls } from '../lib/ai/tools.ts';
import { assessScreening, screeningSummary, usageState } from '../scripts/benchmark-dimensions.mjs';

const frame=(p:unknown)=>'data: '+JSON.stringify(p)+'\n\n';
const finish=(reason:string)=>frame({model:'gpt-4o-mini',choices:[{delta:{},finish_reason:reason}]});
const partial=frame({model:'gpt-4o-mini',choices:[{delta:{content:'private draft'}}]});
const usage=frame({choices:[],usage:{prompt_tokens:10,completion_tokens:4,total_tokens:14}});
async function collect(response:Response, options:Parameters<typeof parseOpenAITextStream>[1]={}) {
  let text='';for await(const delta of parseOpenAITextStream(response,options))text+=delta;return text;
}

test('length drains trailing usage and preserves the original failure despite malformed or foreign trailers',async()=>{
  for(const trailer of [usage+'data: [DONE]\n\n',usage+'data: broken\n\n',frame({model:'foreign',choices:[],usage:{total_tokens:999}})]) {
    const metadata:StreamMetadata[]=[];
    await assert.rejects(()=>collect(new Response(partial+finish('length')+trailer),{expectedModel:'gpt-4o-mini',readUsageAfterStop:true,onMetadata:m=>metadata.push(m)}),
      e=>e instanceof StreamFailure&&e.code==='STREAM_TRUNCATED');
    assert.ok(metadata.some(m=>m.finishReason==='length'));
    assert.ok(!metadata.some(m=>m.usage?.total_tokens===999));
    if(trailer.startsWith(usage))assert.ok(metadata.some(m=>m.usage?.total_tokens===14));
  }
});

test('stop and length metadata drains terminate on idle sockets and bound coalesced trailer bytes',async()=>{
  for(const reason of ['stop','length']) {
    const metadata:StreamMetadata[]=[];let cancelled=false;
    const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(partial+finish(reason)));},cancel(){cancelled=true;}}));
    const started=Date.now(),reading=collect(response,{readUsageAfterStop:true,metadataDrainMs:20,onMetadata:m=>metadata.push(m)});
    if(reason==='length')await assert.rejects(()=>reading,e=>e instanceof StreamFailure&&e.code==='STREAM_TRUNCATED');else await reading;
    assert.ok(Date.now()-started<1000);assert.equal(cancelled,true);assert.ok(metadata.some(m=>m.drainOutcome==='time_limit'));
  }
  const metadata:StreamMetadata[]=[];
  await assert.rejects(()=>collect(new Response(partial+finish('length')+(': heartbeat\n\n'.repeat(100))+usage),{readUsageAfterStop:true,metadataDrainBytes:64,onMetadata:m=>metadata.push(m)}),e=>e instanceof StreamFailure&&e.code==='STREAM_TRUNCATED');
  assert.ok(metadata.some(m=>m.drainOutcome==='byte_limit'));assert.ok(!metadata.some(m=>m.usage));
});

test('abort during a terminal failure drain honors cancellation without erasing length',async()=>{
  const abort=new AbortController(),metadata:StreamMetadata[]=[];
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(partial+finish('length')));}}));
  const reading=collect(response,{signal:abort.signal,readUsageAfterStop:true,onMetadata:m=>{metadata.push(m);if(m.finishReason==='length')queueMicrotask(()=>abort.abort(new Error('user abort')));}});
  await assert.rejects(()=>reading,e=>e instanceof StreamFailure&&e.code==='STREAM_TRUNCATED');
  assert.ok(metadata.some(m=>m.drainOutcome==='aborted'));
});

test('negative, fractional and unsafe usage values never become observed token counts',async()=>{
  const metadata:StreamMetadata[]=[];
  await collect(new Response(partial+finish('stop')+frame({choices:[],usage:{prompt_tokens:-1,completion_tokens:.5,total_tokens:Number.MAX_VALUE}})),{readUsageAfterStop:true,onMetadata:m=>metadata.push(m)});
  assert.ok(metadata.every(m=>!m.usage||Object.keys(m.usage).length===0));
});
test('usage compatibility is scoped to the verified endpoint and EOF alone does not prove metadata was never sent',()=>{
  const body=JSON.parse(buildSumopodChatRequest({apiKey:'LOCAL_FIXTURE',baseUrl:'https://ai.sumopod.com/other-api',modelId:'gpt-4o-mini',systemInstruction:'test',messages:[]}).init.body);
  assert.equal(body.stream_options,undefined);
  const request={body:{stream_options:{include_usage:true}}};
  assert.equal(usageState({attempted:true,request,metadataDrain:'eof',usage:null}).reason,'not_observed_before_eof');
  assert.equal(usageState({attempted:true,request,metadataDrain:'done',usage:null}).reason,'not_sent');
});

test('explicit raw JSON in either word order, numeric and raw-code contracts are checked separately',()=>{
  for(const prompt of ['Jawab JSON saja.','Hanya JSON','Return raw JSON','JSON only']){
    assert.equal(outputContract(prompt),'raw_json');assert.equal(checkOutputContract('```json\n{}\n```',outputContract(prompt)).pass,false);
  }
  assert.equal(outputContract('Jawab angka rupiah bulat saja, tanpa simbol.'),'integer');
  assert.equal(outputContract('Jawab hanya angka.'),'number');
  assert.equal(outputContract('Jawab kode JavaScript mentah saja, tanpa Markdown.'),'raw_code');
  assert.equal(outputContract('Jelaskan perbedaan JSON dan XML.'),null);
  assert.equal(outputContract('Jangan gunakan JSON.'),null);
  assert.equal(checkOutputContract('Rp154000','integer').pass,false);
  assert.equal(checkOutputContract('154000','integer').pass,true);
});

async function environment(run:()=>Promise<void>) {
  const before={...process.env};
  Object.assign(process.env,{SUMOPOD_API_KEY:'LOCAL_CONTRACT_FIXTURE',SUMOPOD_BASE_URL:'https://ai.sumopod.com/v1',AET_ROUTING_MODE:'off',ENABLE_FRONTIER:'false',AET_MAX_REQUEST_USD:'',AET_RUNTIME_PRICING_FILE:'',AET_CHAT_DEADLINE_MS:''});
  resetProviderHealth();
  try{await run();}finally{resetProviderHealth();for(const k of Object.keys(process.env))if(!(k in before))delete process.env[k];Object.assign(process.env,before);}
}
test('failed raw output never becomes a done answer or arbitrary schema; failure telemetry remains available',async()=>environment(async()=>{
  for(const [prompt,answer] of [['Jawab JSON saja dengan field x.','```json\n{"x":1}\n```'],['Jawab angka rupiah bulat saja.','Rp100'],['Jawab kode JavaScript mentah saja.','```js\nx()\n```']]){
    const events:OrchestrationEvent[]=[];
    const session=await createOrchestrator(validateChat({mode:'daily',responseMode:'fast',messages:[{id:'u',role:'user',content:prompt}]}),{signal:new AbortController().signal,
      fetcher:async()=>new Response(frame({model:'gpt-4o-mini',choices:[{delta:{content:answer},finish_reason:'stop'}]})+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})});
    await assert.rejects(()=>session.run(e=>events.push(e)),e=>(e as {code:string}).code==='QUALITY_CONTRACT');
    assert.equal(events.filter(e=>e.event==='delta').length,0);
    assert.ok(events.some(e=>e.event==='meta'&&e.data.failureCode==='QUALITY_CONTRACT'));
    assert.equal(session.budget.attempts.length,1);
  }
}));
test('length telemetry includes trailing cost, stays failed, and is never automatically retried',async()=>environment(async()=>{
  let calls=0;const events:OrchestrationEvent[]=[];
  const session=await createOrchestrator(validateChat({mode:'daily',responseMode:'fast',messages:[{id:'u',role:'user',content:'Jelaskan RAM.'}]}),{signal:new AbortController().signal,
    rates:{'gpt-4o-mini':{inputUsdPerMillion:1,outputUsdPerMillion:2}},fetcher:async()=>{calls++;return new Response(partial+finish('length')+usage+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});}});
  await assert.rejects(()=>session.run(e=>events.push(e)),e=>(e as {code:string}).code==='UPSTREAM_STREAM_TRUNCATED');
  const snapshot=session.budget.snapshot();assert.equal(calls,1);assert.equal(snapshot.attempts[0].status,'failed');assert.equal(snapshot.attempts[0].finishReason,'length');
  assert.equal(snapshot.attempts[0].httpStatus,200);assert.equal(snapshot.attempts[0].usageUnknownReason,null);assert.equal(snapshot.usageBasedCostUsd,.000018);
  assert.equal(events.filter(e=>e.event==='delta').length,0);
}));

test('a latest explicit prose correction releases the earlier JSON contract',async()=>environment(async()=>{
  const input=validateChat({mode:'daily',responseMode:'fast',messages:[{id:'u1',role:'user',content:'Jelaskan RAM. Hanya JSON.'},{id:'a1',role:'assistant',content:'{"ram":"memori sementara"}'},
    {id:'u2',role:'user',content:'Koreksi: jawab dalam paragraf dengan penjelasan singkat.'}]});
  const session=await createOrchestrator(input,{signal:new AbortController().signal,fetcher:async()=>new Response(frame({model:'gpt-4o-mini',choices:[{delta:{content:'RAM menyimpan data sementara.'},finish_reason:'stop'}]}),{headers:{'content-type':'text/event-stream'}})});
  const result=await session.run(()=>{});assert.equal(result.answer,'RAM menyimpan data sementara.');assert.equal(result.metadata.verification.contract,null);
}));

test('explicit calculator intent permits only a narrow numeric suffix, never a general word problem or negated tool',()=>{
  assert.deepEqual(contextualToolCalls('hitung 13*9+2. Jawab angka saja.'),[{name:'calculator',args:['13*9+2']}]);
  for(const text of ['Jangan hitung 13*9+2','Saya membeli 13 buku, tiap buku 9 rupiah. Berapa totalnya?','Jelaskan kode `13*9+2`'])assert.deepEqual(contextualToolCalls(text),[]);
});

test('historical report and rubric remain immutable while fenced JSON gets separate content and format results',async()=>{
  const path='docs/benchmarks/run-2026-10-25T11-17-41-534Z-6f4ddf0d/report.json',bytes=await readFile(path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'782091c2b0eabe5290ad01b472a24759e4cbff3db08f9e7a85e44cb0fc5bfc03');
  const report=JSON.parse(bytes.toString()),cases=JSON.parse(await readFile('tests/fixtures/all-model-benchmark.json','utf8'));
  const c=cases.find((c:{validator:string})=>c.validator==='uncertainty-json'),r=report.results.find((r:{model:string;caseId:string})=>r.model==='gpt-4o-mini'&&r.caseId===c.id);
  const d=assessScreening(c,r);assert.equal(r.status,'FAIL');assert.equal(d.content,'PASS');assert.equal(d.format,'FAIL');assert.equal(d.instructions,'FAIL');
  const summary=screeningSummary(report,cases);assert.equal(summary.reduce((n:number,s:{truncated:number})=>n+s.truncated,0),9);
  assert.equal(summary.reduce((n:number,s:{usage:{known:number}})=>n+s.usage.known,0),23);
  assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
});
