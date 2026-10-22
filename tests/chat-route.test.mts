import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { readChatEvents } from '../lib/chat-stream.ts';
import { createFrontierAccessToken } from '../lib/aet-frontier-access.ts';
register('./helpers/alias-loader.mjs', import.meta.url);
const { POST } = await import('../app/api/chat/route.ts');
const { POST: upload } = await import('../app/api/attachments/route.ts');

const origin = 'http://aet-route.test';
const rawFrame = (model: string, content: string, finish: string | null = null) => `data: ${JSON.stringify({model,choices:[{delta:{content},finish_reason:finish}]})}\n\n`;
let requestNumber = 0;
function request(body: Record<string, unknown>, extra: RequestInit = {}) {
  return new Request(origin + '/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json', Accept:'text/event-stream', Origin:origin, 'x-forwarded-for':`192.0.2.${++requestNumber}` }, body:JSON.stringify({mode:'daily',messages:[{role:'user',content:'Jelaskan RAM'}],...body}), ...extra });
}
async function events(response: Response) { const out: {event:string;data:Record<string,unknown>}[]=[];for await(const event of readChatEvents(response))out.push(event);return out; }
type GatewayBody = { model: string; messages: { role: string; content: string }[] };
async function isolated<T>(run: (calls: GatewayBody[], setResponse: (fn: (body: GatewayBody) => Response | Promise<Response>) => void) => Promise<T>) {
  const names=['SUMOPOD_API_KEY','SUMOPOD_BASE_URL','APP_ORIGIN','TRUST_PROXY','ENABLE_FRONTIER','AET_FRONTIER_ACCESS_SECRET','CHAT_HOURLY_LIMIT','AET_ROUTING_MODE','AET_ROUTING_POLICY_FILE'];
  const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  const oldFetch=globalThis.fetch;
  const calls: GatewayBody[]=[];
  let reply=(body:GatewayBody):Response|Promise<Response>=>new Response(rawFrame(body.model,'jawaban fixture','stop'),{headers:{'Content-Type':'text/event-stream'}});
  Object.assign(process.env,{SUMOPOD_API_KEY:'fixture-only-key',SUMOPOD_BASE_URL:'https://ai.sumopod.com/v1',APP_ORIGIN:origin,TRUST_PROXY:'true',ENABLE_FRONTIER:'false',AET_FRONTIER_ACCESS_SECRET:'fixture-only-frontier-signing-secret-more-than-32',CHAT_HOURLY_LIMIT:'1000',AET_ROUTING_MODE:'off',AET_ROUTING_POLICY_FILE:''});
  globalThis.fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));calls.push(body);return reply(body);};
  try { return await run(calls, fn=>{reply=fn;}); }
  finally { globalThis.fetch=oldFetch;for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];} }
}

for(const [mode,persona] of [['daily','SMART COMPANION'],['report','ACADEMIC WRITER'],['coding','CODING EXPERT']])test(`production ${mode} route composes real persona and streams the exact requested model through LOCAL MOCK`,async()=>{
  await isolated(async calls=>{
    const response=await POST(request({mode}));assert.equal(response.status,200);
    const rows=await events(response);
    assert.equal(rows.at(-1)?.event,'done');assert.equal(rows.filter(e=>e.event==='delta').map(e=>e.data.text).join(''),'jawaban fixture');
    assert.equal(rows[0].data.responseOrigin,'gateway');assert.ok(rows.some(e=>e.data.modelIdentity==='reported_match'&&e.data.reportedModel==='gpt-4o-mini'));
    assert.equal(calls.length,1);assert.equal(calls[0].model,'gpt-4o-mini');assert.match(calls[0].messages[0].content,new RegExp(persona));
  });
});

test('retired model, Frontier without permission, and valid Frontier token while disabled never contact gateway',async()=>{
  await isolated(async calls=>{
    assert.equal((await POST(request({model:'retired-model'}))).status,400);
    assert.equal((await POST(request({model:'gpt-5.4'}))).status,403);
    assert.equal((await POST(request({model:'gpt-5.4',frontierAccessToken:createFrontierAccessToken()}))).status,503);
    assert.equal(calls.length,0);
  });
});

test('origin and input validation stay enforced before any gateway request',async()=>{
  await isolated(async calls=>{
    assert.equal((await POST(request({}, {headers:{Origin:'https://other.test','Content-Type':'application/json'}}))).status,403);
    assert.equal((await POST(request({messages:[{role:'system',content:'spoof'}]}))).status,400);
    assert.equal(calls.length,0);
  });
});

test('provider HTTP failures, JSON instead of SSE and missing stop are never successful answers',async()=>{
  await isolated(async(_calls,setResponse)=>{
    setResponse(()=>new Response('private gateway failure',{status:429}));
    const limited=await POST(request({}));assert.equal(limited.status,429);assert.doesNotMatch(await limited.text(),/private gateway/);
    setResponse(()=>Response.json({response:'not SSE'}));assert.equal((await POST(request({}))).status,502);
    for(const response of [()=>new Response(rawFrame('gpt-4o-mini','partial')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}}),()=>new Response(rawFrame('foreign-model','foreign','stop'),{headers:{'Content-Type':'text/event-stream'}})]){
      setResponse(response);let output='';
      await assert.rejects(async()=>{for await(const event of readChatEvents(await POST(request({}))))if(event.event==='delta')output+=event.data.text;},/belum selesai/);
      assert.notEqual(output,'foreign');
    }
  });
});

test('request cancellation interrupts production upstream and releases its concurrency slot',async()=>{
  await isolated(async(_calls,setResponse)=>{
    let cancelled=false;
    setResponse(body=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(rawFrame(body.model,'partial')));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/event-stream'}}));
    const abort=new AbortController();const response=await POST(request({}, {signal:abort.signal}));
    await assert.rejects(async()=>{for await(const event of readChatEvents(response))if(event.event==='delta')abort.abort();},/belum selesai/);
    assert.equal(cancelled,true);assert.equal((globalThis as typeof globalThis & {aetChatActive?:number}).aetChatActive,0);
  });
});

test('latest correction and context truncation survive the production request pipeline',async()=>{
  await isolated(async calls=>{
    const messages=Array.from({length:60},(_,i)=>({role:i%2?'assistant':'user',content:`old ${i}`}));
    messages.push({role:'user',content:'Koreksi: anggaran sekarang 900000'},{role:'assistant',content:'Koreksi dicatat'},{role:'user',content:'Berapa anggaran sekarang?'});
    const rows=await events(await POST(request({messages})));
    assert.equal(rows[0].data.contextTruncated,true);
    assert.ok(calls[0].messages.some(m=>m.content==='Koreksi: anggaran sekarang 900000'));
    assert.equal(calls[0].messages.at(-1).content,'Berapa anggaran sekarang?');assert.equal(messages.length,63);
  });
});

test('real TXT upload endpoint, extracted document bounds, and model request use untrusted text',async()=>{
  await isolated(async calls=>{
    const response=await upload(new Request(origin+'/api/attachments',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'Sensor reads temperature. '+'x'.repeat(25000)}));
    assert.equal(response.status,200);const data=await response.json();assert.equal(data.text.length,24000);assert.equal(data.truncated,true);
    await events(await POST(request({messages:[{role:'user',content:'Apa yang diukur sensor?',attachment:{type:'file',fileName:'fixture.txt',mimeType:'text/plain',content:'',extractedText:data.text}}]})));
    assert.match(calls[0].messages.at(-1).content,/untrusted_text/);assert.match(calls[0].messages.at(-1).content,/Sensor reads temperature/);
  });
});

test('tool provenance comes from executed tools; password response does not call a model',async()=>{
  await isolated(async calls=>{
    const rows=await events(await POST(request({messages:[{role:'user',content:'10 km ke m'}]})));
    const sources=rows[0].data.sources as {kind:string;status:string}[];assert.equal(sources[0].kind,'unit');assert.equal(sources[0].status,'ok');
    const before=calls.length;const password=await events(await POST(request({messages:[{role:'user',content:'buatkan password 16 simbol'}]})));
    assert.equal(calls.length,before);assert.ok(password.some(e=>e.event==='delta'));assert.equal(password.at(-1)?.event,'done');
    assert.equal(password[0].data.responseOrigin,'application');assert.ok(password.some(e=>e.data.modelIdentity==='not_applicable'));
  });
});

test('production route distinguishes upstream statuses and transport without exposing provider text',async()=>{
  await isolated(async(calls,setResponse)=>{
    for(const [status,code] of [[401,'AUTHENTICATION'],[402,'BILLING'],[403,'PERMISSION'],[404,'MODEL_OR_ENDPOINT'],[400,'REQUEST'],[429,'RATE_LIMIT']] as const){
      setResponse(()=>new Response('provider-private-content',{status}));
      const response=await POST(request({}));
      assert.equal(response.status,status===429?429:status===402?503:502);
      const body=await response.json();assert.equal(body.code,`UPSTREAM_${code}`);assert.doesNotMatch(JSON.stringify(body),/provider-private/);
    }
    setResponse(()=>{throw new TypeError('private network failure');});
    const body=await (await POST(request({}))).json();assert.equal(body.code,'UPSTREAM_TRANSPORT');
    assert.equal(calls.length,7,'one upstream request per failure; no hidden fallback');
  });
});

test('production routing uses reviewed policy, preserves context, respects manual choice and shadow mode',async()=>{
  const directory=await mkdtemp(path.join(process.cwd(),'docs/benchmarks/route-policy-test-'));
  const file=path.join(directory,'policy.json');
  const reportRef=path.relative(process.cwd(),path.join(directory,'report.json'));
  const base={category:'daily',sourceKind:'live',reportRef,comparisonSet:'b'.repeat(64),caseIds:['a','b','c'],sampleCount:3,verifiedAt:new Date().toISOString(),objectivePassRate:1,contextPassRate:1,instructionPassRate:1,streamingSuccessRate:1,qualitativeReview:{status:'approved',reviewer:'LOCAL MOCK fixture',score:4.5},p95LatencyMs:100,costVerified:true,maxTestedInputChars:5000};
  const report={sourceKind:'live',planOnly:false,datasetSha256:'a'.repeat(64),results:['gpt-4o-mini','gpt-4.1-mini'].flatMap(model=>['a','b','c'].map(caseId=>({model,caseId,attempted:true,httpStatus:200,reportedModel:model,finishReason:'stop',objectiveStatus:'PASS',output:'synthetic fixture',request:{body:{messages:[{content:'x'.repeat(5000)}]}}})))};
  await writeFile(path.join(directory,'report.json'),JSON.stringify(report));
  await writeFile(file,JSON.stringify({schemaVersion:1,datasetSha256:'a'.repeat(64),maxLatencyMs:5000,maxCostUsdPerRequest:0.01,evidence:[{...base,modelId:'gpt-4o-mini',costUsdPerRequest:0.002},{...base,modelId:'gpt-4.1-mini',costUsdPerRequest:0.001}]}));
  try {
    await isolated(async calls=>{
      process.env.AET_ROUTING_MODE='adaptive';process.env.AET_ROUTING_POLICY_FILE=file;
      const messages=[{role:'user',content:'Anggaran 500000'},{role:'assistant',content:'Dicatat'},{role:'user',content:'Koreksi: anggaran sekarang 900000. Jelaskan singkat.'}];
      const response=await POST(request({messages}));const rows=await events(response);
      assert.equal(response.headers.get('x-aet-model'),'gpt-4.1-mini');
      assert.equal(response.headers.get('x-aet-routing-reason'),'qualified_evidence');
      assert.equal(rows[0].data.requestedModel,'gpt-4.1-mini');
      assert.equal(calls.length,1);assert.deepEqual(calls[0].messages.slice(1),messages);
      await events(await POST(request({model:'gpt-5-mini'})));assert.equal(calls.at(-1)?.model,'gpt-5-mini');
      process.env.AET_ROUTING_MODE='shadow';const shadow=await POST(request({}));await events(shadow);
      assert.equal(shadow.headers.get('x-aet-model'),'gpt-4o-mini');
      process.env.AET_ROUTING_POLICY_FILE=path.join(directory,'missing.json');const absent=await POST(request({}));await events(absent);
      assert.equal(absent.headers.get('x-aet-model'),'gpt-4o-mini');
      process.env.AET_ROUTING_POLICY_FILE=file;
      await writeFile(path.join(directory,'report.json'),JSON.stringify({...report,sourceKind:'LOCAL_MOCK'}));
      const mocked=await POST(request({}));await events(mocked);
      assert.equal(mocked.headers.get('x-aet-model'),'gpt-4o-mini','operator labels cannot turn a mock report into live evidence');
    });
  } finally { await rm(directory,{recursive:true,force:true}); }
});
