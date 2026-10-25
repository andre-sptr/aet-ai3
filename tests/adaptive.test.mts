import test, {beforeEach} from 'node:test';
import {resetProviderHealth} from '../lib/ai/provider-health.ts';
beforeEach(()=>resetProviderHealth());
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { validateChat } from '../lib/ai/context.ts';
import { MODE_POLICIES, normalizeResponseMode } from '../lib/ai/mode-policy.ts';
import { RequestBudget, BudgetExceeded } from '../lib/ai/budget.ts';
import { deriveConversationState } from '../lib/ai/conversation-state.ts';
import { createOrchestrator, type OrchestrationEvent } from '../lib/ai/orchestration.ts';
import { generateText, acquireProvider } from '../lib/ai/provider.ts';
import { parsePlan, parseWorker, parseReview } from '../lib/ai/structured-output.ts';
import { calculate, contextualToolCalls, validateToolCalls } from '../lib/ai/tools.ts';
import { checkAnswer } from '../lib/ai/verification.ts';
import type { Message, ResponseMode } from '../types/index.ts';
import { newConversation, loadConversationStore, lightweightStore, historyForModel } from '../lib/conversations.ts';
const msg=(content:string,id=crypto.randomUUID(),role:Message['role']='user'):Message=>({id,content,role,timestamp:new Date(0),status:'complete'});
const frame=(model:string,content:string,usage?:object)=>new Response(`data: ${JSON.stringify({model,choices:[{delta:{content},finish_reason:'stop'}]})}\n\ndata: ${JSON.stringify({choices:[],...(usage?{usage}:{})})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
process.env.SUMOPOD_API_KEY='local-mock-key'; process.env.ENABLE_FRONTIER='false'; process.env.AET_ROUTING_MODE='off';
const request=(text:string,responseMode:ResponseMode='normal',extra:object={})=>validateChat({mode:'daily',responseMode,messages:[msg(text)],...extra});

test('response mode default, validation and legacy model migration cannot request Frontier',()=>{
 assert.equal(normalizeResponseMode(undefined),'normal');
 assert.equal(validateChat({mode:'coding',messages:[msg('hi')],model:'gpt-5.4'}).legacyModelIgnored,true);
 for(const mode of ['fast','normal','think'] as const)assert.equal(request('hi',mode).responseMode,mode);
 for(const responseMode of [null,'coding','Fast',{},42])assert.throws(()=>request('hi',responseMode as ResponseMode));
 assert.throws(()=>validateChat({mode:'daily',messages:[msg('one','duplicate'),msg('two','duplicate')]}));
});

test('structured state retains early constraints, records correction provenance and recomputes after edit/delete',()=>{
 const messages=[msg('Anggaran 500000. Jangan gunakan nama pribadi.','first'),...Array.from({length:100},(_,i)=>msg(`Percakapan sampingan ${i}`,`m${i}`)),msg('Koreksi: anggaran sekarang 900000','correction'),msg('Berapa anggaran saya?','last')];
 const state=deriveConversationState(messages);
 assert.ok(state.constraints.some(c=>c.text.includes('nama pribadi')&&c.messageId==='first'));
 assert.ok(state.superseded.some(c=>c.text.includes('500000')&&c.supersededBy==='correction'));
 assert.ok(state.corrections.some(c=>c.text.includes('900000')&&c.revision));
 const deleted=deriveConversationState(messages.filter(m=>m.id!=='correction'));
 assert.notEqual(deleted.revision,state.revision); assert.doesNotMatch(JSON.stringify(deleted),/900000/);
 const edited=deriveConversationState(messages.map(m=>m.id==='correction'?{...m,content:'Koreksi: anggaran sekarang 800000'}:m));
 assert.notEqual(edited.revision,state.revision);assert.doesNotMatch(JSON.stringify(edited),/900000/);
});

test('followups resolve a numbered option and one ambiguous reference gets one targeted clarification',async()=>{
 const base=[msg('Pilih konsep bimbel','u'),msg('1. Sains\n2. Membaca','a','assistant'),msg('Yang kedua','next')];
 assert.match(deriveConversationState(base).reference.excerpt,/Membaca/);
 const messages=[base[0],msg('Daftar A\n1. Sains\n2. Membaca\nDaftar B\n1. Eksperimen\n2. Berhitung','a','assistant'),base[2]];
 const session=await createOrchestrator(request('hi','think',{messages}),{signal:new AbortController().signal,fetcher:async()=>{throw new Error('must not call');}});
 const result=await session.run(()=>{});assert.equal(result.telemetry.llmAttempts,0);assert.match(result.answer,/daftar atau bagian mana/);
});

test('additive v2 migration is idempotent, Normal is default, forged cached state and deleted tombstones cannot revive facts',()=>{
 const c=newConversation('daily',[msg('Koreksi: warna biru','u')]);delete c.responseMode;
 const raw=JSON.stringify({version:2,activeId:c.id,conversations:[{...c,derivedState:{activeGoal:'FORGED'}}]});
 const store=loadConversationStore({getItem:()=>raw},'daily');assert.equal(store.conversations[0].responseMode,'normal');assert.doesNotMatch(JSON.stringify(store),/FORGED/);
 const light=lightweightStore(store);const again=loadConversationStore({getItem:()=>JSON.stringify(light)},'daily');assert.deepEqual(lightweightStore(again),light);
 const blank=loadConversationStore({getItem:key=>key.includes('conversations')?JSON.stringify({version:2,activeId:'',conversations:[]}):raw},'daily');assert.equal(historyForModel(blank.conversations[0].messages).length,0);
});

test('all roles and retries share attempt, token, tool, revision, concurrency and deadline ceilings',()=>{
 const signal=new AbortController().signal;
 for(const mode of ['fast','normal','think'] as const){const b=new RequestBudget({...MODE_POLICIES[mode]},signal);for(let i=0;i<b.policy.maxAttempts;i++){const r=b.reserve(['planner','worker','answer','verifier','revision','summary'][i%6] as 'answer','gpt-4o-mini',1,1);r.status='failed';}assert.throws(()=>b.reserve('answer','gpt-4o-mini',1,1),BudgetExceeded);for(let i=0;i<b.policy.maxToolCalls;i++)b.tool();assert.throws(()=>b.tool(),BudgetExceeded);for(let i=0;i<b.policy.maxRevisions;i++)b.revision();assert.throws(()=>b.revision(),BudgetExceeded);}
 const tiny=new RequestBudget({...MODE_POLICIES.normal,inputTokens:50,outputTokens:10},signal);assert.throws(()=>tiny.reserve('answer','gpt-4o-mini',51,1));assert.throws(()=>tiny.reserve('answer','gpt-4o-mini',1,11));
 const concurrent=new RequestBudget({...MODE_POLICIES.normal},signal);concurrent.reserve('worker','gpt-4o-mini',1,1);assert.throws(()=>concurrent.reserve('worker','gpt-4o-mini',1,1));
 const aborted=new AbortController();aborted.abort();assert.throws(()=>new RequestBudget({...MODE_POLICIES.normal},aborted.signal).tool());
});

test('optional work must leave a final-answer reserve; unknown usage and price are null rather than zero',()=>{
 const b=new RequestBudget({...MODE_POLICIES.fast},new AbortController().signal);assert.equal(b.canReserve(100,100,true,'gpt-4o-mini'),false,'Fast has no spare output reserve for a planner');
 const r=b.reserve('answer','gpt-4o-mini',100,100);r.status='complete';assert.equal(b.snapshot().usage,null);assert.equal(b.snapshot().usageBasedCostUsd,null);assert.equal(b.snapshot().actualBilledCostUsd,null);
 const priced=new RequestBudget({...MODE_POLICIES.normal},new AbortController().signal,{'gpt-4o-mini':{inputUsdPerMillion:1,outputUsdPerMillion:2}},0.00001);assert.throws(()=>priced.reserve('answer','gpt-4o-mini',100,100));
});

for(const mode of ['fast','normal','think'] as const)test(`${mode} simple work completes in one generation, ignores legacy model, and publishes only final deltas`,async()=>{
 let calls=0;const events:OrchestrationEvent[]=[];
 const session=await createOrchestrator(request('Jelaskan RAM singkat',mode,{model:'gpt-5.4'}),{signal:new AbortController().signal,fetcher:async(_u,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.model,'gpt-4o-mini');assert.equal('temperature' in body,false);assert.equal('tools' in body,false);return frame(body.model,'RAM menyimpan data sementara.');}});
 const result=await session.run(e=>events.push(e));assert.equal(calls,1);assert.equal(result.answer,'RAM menyimpan data sementara.');assert.equal(result.telemetry.usage,null);assert.equal(result.metadata.legacyModelIgnored,true);assert.equal(result.metadata.access,'public_only');
 assert.ok(events.findIndex(e=>e.event==='status'&&e.data.stage==='final')<events.findIndex(e=>e.event==='delta'));assert.equal(result.metadata.verification.claimsVerified,false);
});

test('Think selective two workers, bounded verifier and one targeted revision use at most six attempts',async()=>{
 let active=0,peak=0;const roles:string[]=[];const events:OrchestrationEvent[]=[];
 const session=await createOrchestrator(request('Bandingkan dua arsitektur cache dan analisis batasannya. Hanya JSON.','think'),{signal:new AbortController().signal,fetcher:async(_u,init)=>{
  const b=JSON.parse(String(init?.body)),s=b.messages[0].content;let text='';
  if(s.includes('Buat rencana JSON saja')){roles.push('planner');text=JSON.stringify({subgoals:['Arsitektur A','Arsitektur B'],tools:[]});}
  else if(s.includes('Kerjakan hanya subtujuan')){roles.push('worker');active++;peak=Math.max(peak,active);await delay(5);active--;text=JSON.stringify({conclusion:'PRIVATE WORKER RESULT',evidenceIds:[],assumptions:[],unresolved:[]});}
  else if(s.includes('Periksa draft')){roles.push('verifier');text=JSON.stringify({verdict:'revise',issues:[{kind:'format',detail:'Draft bukan JSON valid.'}]});}
  else if(s.includes('Perbaiki hanya masalah')){roles.push('revision');text='{"result":"ok"}';}
  else {roles.push('answer');text='PRIVATE INVALID DRAFT';}
  return frame(b.model,text,{prompt_tokens:12,completion_tokens:4,total_tokens:16});
 }});
 const result=await session.run(e=>events.push(e));assert.deepEqual(roles,['planner','worker','worker','answer','verifier','revision']);assert.equal(peak,2);assert.equal(result.telemetry.llmAttempts,6);assert.equal(result.telemetry.revisions,1);assert.equal(result.answer,'{"result":"ok"}');assert.doesNotMatch(events.filter(e=>e.event==='delta').map(e=>e.data.text).join(''),/PRIVATE/);
});

test('malformed planner or verifier is bounded and never executed as code',async()=>{
 let calls=0;const session=await createOrchestrator(request('Bandingkan dua arsitektur secara mendalam','think'),{signal:new AbortController().signal,fetcher:async(_u,init)=>{calls++;const b=JSON.parse(String(init?.body));return frame(b.model,b.messages[0].content.includes('Jawab tugas pengguna')?'Hasil terbatas sesuai data.':'process.exit(0)');}});
 const result=await session.run(()=>{});assert.equal(calls,3);assert.equal(result.metadata.stageFailures.length,2);assert.equal(result.telemetry.revisions,0);
 for(const value of ['{"subgoals":[],"tools":[{"name":"exec","args":["rm -rf"]}]}','{"subgoals":["a","b","c"]}'])assert.throws(()=>parsePlan(value));
 assert.throws(()=>parseWorker('{"conclusion":"x","evidenceIds":["forged"],"assumptions":[],"unresolved":[]}',[]));assert.throws(()=>parseReview('{"verdict":"verified","issues":[]}'));
});

test('every LLM role checks Frontier permission before fetch, including verifier, worker, planner and retry candidate',async()=>{
 let called=0;
 for(const role of ['answer','worker','planner','verifier','revision','classifier','summary'] as const){const budget=new RequestBudget({...MODE_POLICIES.think},new AbortController().signal);await assert.rejects(()=>generateText({role,modelId:'gpt-5.4',persona:'daily',system:'test',messages:[{role:'user',content:'hi'}],outputLimit:64,budget,fetcher:async()=>{called++;return frame('gpt-5.4','x');}}),e=>(e as {code:string}).code==='FRONTIER_REQUIRED');}
 assert.equal(called,0);
});

test('HTTP transport retry counts twice, billing and Retry-After stop without model rotation',async()=>{
 for(const status of [500,402,429]){resetProviderHealth();let calls=0;const b=new RequestBudget({...MODE_POLICIES.normal},new AbortController().signal);await assert.rejects(()=>generateText({role:'answer',modelId:'gpt-4o-mini',persona:'daily',system:'test',messages:[{role:'user',content:'hi'}],outputLimit:64,budget:b,fetcher:async()=>{calls++;return new Response('secret error',{status,headers:{'Retry-After':'120'}});}}),e=>status!==429||(e as {retryAfter:string}).retryAfter==='120');assert.equal(calls,status===500?2:1);assert.equal(b.attempts.length,calls);assert.ok(b.attempts.every(a=>a.model==='gpt-4o-mini'&&a.status==='failed'));}
});

test('global provider semaphore queues work and abort removes waiting work without taking capacity',async()=>{
 process.env.AET_PROVIDER_MAX_CONCURRENT='1';const parent=new AbortController();const first=await acquireProvider(parent.signal);const pending=new AbortController();const second=acquireProvider(pending.signal);pending.abort();await assert.rejects(()=>second);first();const third=await acquireProvider(parent.signal);third();delete process.env.AET_PROVIDER_MAX_CONCURRENT;
});

test('cancellation aborts both parallel Think workers and never publishes draft or complete output',async()=>{
 const abort=new AbortController();let active=0,cancelled=0;let workersReady:()=>void=()=>{};const ready=new Promise<void>(r=>{workersReady=r;});const events:OrchestrationEvent[]=[];
 const session=await createOrchestrator(request('Bandingkan dua arsitektur secara mendalam','think'),{signal:abort.signal,fetcher:async(_u,init)=>{const b=JSON.parse(String(init?.body));if(b.messages[0].content.includes('Buat rencana'))return frame(b.model,'{"subgoals":["A","B"],"tools":[]}');active++;if(active===2)workersReady();return new Promise<Response>((_r,reject)=>init!.signal!.addEventListener('abort',()=>{cancelled++;reject(new Error('aborted'));},{once:true}));}});
 const running=session.run(e=>events.push(e));await ready;abort.abort();await assert.rejects(()=>running);assert.equal(cancelled,2);assert.equal(events.filter(e=>e.event==='delta').length,0);
});

test('tools respect context, deterministic arithmetic is exact within limits, and model text cannot execute commands',async()=>{
 assert.equal(calculate('(12*15000)*0.8+10000'),154000);for(const expr of ['process.exit(0)','1/0','(2+3','2**3','2;3'])assert.throws(()=>calculate(expr));
 assert.deepEqual(contextualToolCalls('Jangan gunakan alat; harga terbaru'),[]);assert.equal(contextualToolCalls('hari ini berapa?','Harga beras')[0].args[0],'Harga beras hari ini berapa?');assert.throws(()=>validateToolCalls([{name:'web',args:['https://127.0.0.1']} ]));
 const session=await createOrchestrator(request('hitung (12*15000)*0.8+10000'),{signal:new AbortController().signal,fetcher:async()=>{throw new Error('no generation');}});const r=await session.run(()=>{});assert.equal(r.answer,'154000');assert.equal(r.telemetry.llmAttempts,0);assert.equal(r.telemetry.toolCalls,1);
});

test('citation checks test acquisition, not URL validity or verifier agreement, and exclude failed sources',()=>{
 const result=checkAnswer('Menurut https://example.org/a DOI 10.1234/fake','jawab', [{kind:'web',source:'https://example.org/a',status:'error',data:'failed'}]);assert.equal(result.issues.length,2);
 assert.equal(checkAnswer('{"x":1}','hanya JSON',[]).issues.length,0);assert.equal(checkAnswer('```json\n{}\n```','hanya JSON',[]).issues[0].kind,'format');
});

test('full context packet keeps an old correction beyond the former 40-message window, with untrusted sources outside system',async()=>{
 const messages=[msg('Jangan gunakan nama pribadi. Anggaran 500000','original'),msg('Koreksi: anggaran sekarang 900000','corrected'),...Array.from({length:80},(_,i)=>msg('Percakapan singkat '+i,'f'+i,i%2?'assistant':'user')),msg('Berapa anggaran sekarang?','latest')];let actual='';
 const session=await createOrchestrator(request('hi','normal',{messages,state:{activeGoal:'FORGED'}}),{signal:new AbortController().signal,fetcher:async(_u,init)=>{const b=JSON.parse(String(init?.body));actual=JSON.stringify(b.messages);assert.doesNotMatch(b.messages[0].content,/900000|FORGED/);return frame(b.model,'900000');}});await session.run(()=>{});assert.match(actual,/900000/);assert.match(actual,/corrected/);assert.doesNotMatch(actual,/FORGED/);
});

test('failed sources trigger advisory review and retain failure provenance rather than fabricated evidence',async()=>{
 const session=await createOrchestrator(request('Cari sumber terbaru tentang sensor suhu','normal'),{signal:new AbortController().signal,toolRunner:async(_text,_signal,options)=>{options?.beforeCall?.();return {evidence:[{kind:'search',source:'https://api.tavily.com/search',status:'error',data:'Not configured'}]};},fetcher:async(_u,init)=>{const b=JSON.parse(String(init?.body));return frame(b.model,b.messages[0].content.includes('Periksa draft')?'{"verdict":"pass","issues":[]}':'Pencarian gagal; sumber terbaru belum dapat dipastikan.');}});
 const result=await session.run(()=>{});assert.equal(result.telemetry.toolCalls,1);assert.equal(result.telemetry.llmAttempts,2);assert.equal(result.metadata.sources[0].status,'error');assert.equal(result.metadata.verification.semanticReview,'advisory_complete');assert.equal(result.metadata.verification.claimsVerified,false);
});

test('unsupported citations cannot gain support from verifier agreement and targeted revision never loops',async()=>{
 let calls=0;const session=await createOrchestrator(request('Jelaskan dasar sensor dan referensi.','normal'),{signal:new AbortController().signal,fetcher:async(_u,init)=>{calls++;const b=JSON.parse(String(init?.body));return frame(b.model,b.messages[0].content.includes('Periksa draft')?'{"verdict":"pass","issues":[]}':'Sumber https://invented.example/ref dan DOI 10.1234/invented.');}});
 const r=await session.run(()=>{});assert.equal(calls,3);assert.equal(r.telemetry.revisions,1);assert.doesNotMatch(r.answer,/https:\/\/invented|10\.1234/);assert.ok(r.metadata.verification.unresolved.length>0);
});

test('shared provider rate limit prevents a different candidate from bypassing quota',async()=>{
 let calls=0;const signal=new AbortController().signal;const fetcher:typeof fetch=async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});};
 for(const modelId of ['gpt-4o-mini','gpt-4.1-mini'])await assert.rejects(()=>generateText({role:'worker',modelId,persona:'daily',system:'test',messages:[{role:'user',content:'hi'}],outputLimit:64,budget:new RequestBudget({...MODE_POLICIES.think},signal),fetcher}));
 assert.equal(calls,1);
});

test('output usage exceeding a reservation is a failure, not an opportunity for additional model work',async()=>{
 const b=new RequestBudget({...MODE_POLICIES.normal},new AbortController().signal);await assert.rejects(()=>generateText({role:'answer',modelId:'gpt-4o-mini',persona:'daily',system:'test',messages:[{role:'user',content:'hi'}],outputLimit:64,budget:b,fetcher:async()=>frame('gpt-4o-mini','answer',{prompt_tokens:10,completion_tokens:65,total_tokens:75})}),e=>(e as {code:string}).code==='UPSTREAM_USAGE_EXCEEDS_RESERVATION');assert.equal(b.attempts.length,1);assert.equal(b.attempts[0].status,'failed');assert.equal(b.snapshot().usage?.outputTokens,65);
});

test('whole-input accounting includes system/state/documents and rejects an oversized final request before generation',async()=>{
 let calls=0;const session=await createOrchestrator(request('x'.repeat(30000),'normal',{messages:[msg('x'.repeat(30000),'last')].map(m=>({...m,attachment:{type:'file',content:'',mimeType:'text/plain',fileName:'x.txt',extractedText:'y'.repeat(24000)}}))}),{signal:new AbortController().signal,fetcher:async()=>{calls++;return frame('gpt-4o-mini','x');}});await assert.rejects(()=>session.run(()=>{}),e=>(e as {code:string}).code==='CONTEXT_LIMIT');assert.equal(calls,0);
});

test('Fast, Normal and Think use the same user-requested output limit for simple work',async()=>{
 const caps:number[]=[];for(const mode of ['fast','normal','think'] as const){const session=await createOrchestrator(request('Jelaskan RAM dalam 200 kata.',mode),{signal:new AbortController().signal,fetcher:async(_u,init)=>{const b=JSON.parse(String(init?.body));caps.push(b.max_tokens);return frame(b.model,'Jawaban simulasi.');}});await session.run(()=>{});}assert.equal(new Set(caps).size,1);
});

test('asking about a current value is a reference, not a replacement correction',()=>{
 const state=deriveConversationState([msg('Anggaran saya 500000','first'),msg('Koreksi: anggaran sekarang 900000','corrected'),msg('Berapa anggaran sekarang?','question')]);assert.equal(state.constraints.find(c=>c.key==='anggaran')?.messageId,'corrected');assert.ok(!state.corrections.some(c=>c.messageId==='question'));assert.equal(state.superseded.filter(c=>c.supersededBy==='question').length,0);
});

test('example URLs inside code are not mistaken for acquired source citations',()=>{
 const code='Contoh:\n```js\nfetch("https://api.example.com/data");\n```';assert.equal(checkAnswer(code,'Buat contoh fetch JavaScript',[]).issues.length,0);assert.equal(checkAnswer('Bukti: https://api.example.com/data','Jelaskan',[]).issues.length,1);
});
test('provider rejects image input for an unverified model before any attempt or fetch',async()=>{
 let calls=0;const budget=new RequestBudget({...MODE_POLICIES.normal},new AbortController().signal);
 await assert.rejects(()=>generateText({role:'answer',modelId:'gpt-4.1-mini',persona:'daily',system:'fixture',
  messages:[{role:'user',content:[{type:'image_url',image_url:{url:'data:image/png;base64,AA=='}}]}],outputLimit:64,budget,
  fetcher:async()=>{calls++;return frame('gpt-4.1-mini','x');}}),e=>(e as {code:string}).code==='IMAGE_UNSUPPORTED');
 assert.equal(calls,0);assert.equal(budget.attempts.length,0);
});
