/** Production orchestration evaluator. Default is a no-network plan. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createOrchestrator } from '../lib/ai/orchestration.ts';
import { validateChat, selectContext } from '../lib/ai/context.ts';
import { prepareMessages } from '../lib/ai/message-context.ts';
import { buildSystemPrompt } from '../lib/ai/personas/prompt-builder.ts';
import { generateText } from '../lib/ai/provider.ts';
import { RequestBudget } from '../lib/ai/budget.ts';
import { MODE_POLICIES } from '../lib/ai/mode-policy.ts';
import { getGenerationConfig } from '../lib/ai/model-config.ts';
import { runTools } from '../lib/ai/tools.ts';
import { AI_MODELS } from '../lib/ai-models.ts';
import { loadBudgetGuard, loadPricing, estimateRequestCost, redact, validateLastFunction } from './benchmark-core.mjs';

const argv=process.argv.slice(2);
const option=(name,otherwise)=>{const i=argv.indexOf(name);return i<0?otherwise:argv[i+1];};
const planOnly=!argv.includes('--live')&&!argv.includes('--mock');
const mock=argv.includes('--mock');
if(mock&&argv.includes('--live'))throw new Error('Choose --mock OR --live.');
const repeats=Number(option('--repeat','3'));
if(!Number.isInteger(repeats)||repeats<1||repeats>10)throw new Error('--repeat must be 1..10.');
const maxRequests=Number(option('--max-requests',process.env.AET_BENCHMARK_MAX_REQUESTS||'96'));
if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>500)throw new Error('--max-requests must be 1..500.');
const root=option('--out',`evaluation/run-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
await fs.mkdir(root,{recursive:true});
const reportPath=path.join(root,'report.json');
await fs.writeFile(reportPath,'',{flag:'wx'}); // Never overwrite earlier evidence.
const fixtureBytes=await fs.readFile('tests/fixtures/adaptive-evaluation.json','utf8');
let cases=JSON.parse(fixtureBytes);
const filter=option('--cases','');if(filter)cases=cases.filter(c=>filter.split(',').includes(c.id));
if(!cases.length)throw new Error('No matching cases.');
const variants=['baseline','fast','normal','think'];
const rows=[];
for(let repeat=0;repeat<repeats;repeat++)for(const c of cases)for(let j=0;j<variants.length;j++)rows.push({sampleId:randomUUID(),caseId:c.id,category:c.category,persona:c.persona,variant:variants[(j+repeat)%variants.length],repeat:repeat+1,status:'NOT_RUN',answer:'',checks:[],latencyMs:null,usage:null,usageBasedCostUsd:null,actualBilledCostUsd:null});
let guard={allowed:false,reason:'Plan only; no network.'},pricing={allowed:false};
if(!planOnly&&!mock){guard=await loadBudgetGuard();pricing=await loadPricing(process.env,['gpt-4o-mini']);if(process.env.AET_LIVE_TEST_APPROVED!=='true')guard={allowed:false,reason:'Set AET_LIVE_TEST_APPROVED=true only after checking the provider cap.'};if((process.env.SUMOPOD_BASE_URL||'https://ai.sumopod.com/v1').replace(/\/+$/,'')!=='https://ai.sumopod.com/v1')guard={allowed:false,reason:'Live evaluation is restricted to the key-bound official gateway.'};}
if(mock){process.env.AET_PROVIDER_CALLS_PER_MINUTE='10000';process.env.SUMOPOD_API_KEY='LOCAL_MOCK_NO_SECRET';process.env.AET_ROUTING_MODE='off';delete process.env.AET_ROUTING_POLICY_FILE;delete process.env.AET_MAX_REQUEST_USD;delete process.env.AET_RUNTIME_PRICING_FILE;pricing={allowed:true,models:{'gpt-4o-mini':{inputUsdPerMillion:0.1,outputUsdPerMillion:0.5}}};guard={allowed:true,hardLimitUsd:3,evidence:'LOCAL_MOCK ONLY. No provider cap is asserted.'};}
let modelRequests=0,reservedUsd=0,circuit=null,currentCase;
const prices=pricing.allowed?pricing.models:{};
const cap=guard.allowed?guard.hardLimitUsd*0.8:0;
const liveFetch=async(url,init)=>{
 const body=JSON.parse(init.body);
 const estimate=estimateRequestCost(body,pricing);
 if(modelRequests>=maxRequests) {circuit='Global generation limit reached.';throw new Error(circuit);}
 if(!estimate||reservedUsd+estimate.estimatedCeilingUsd>cap){circuit='Remaining verified budget cannot reserve this attempt.';throw new Error(circuit);}
 modelRequests++;reservedUsd+=estimate.estimatedCeilingUsd;
 if(mock){
  const system=body.messages[0].content;let output=currentCase.mockReference??currentCase.reference;
  if(system.includes('Buat rencana JSON saja'))output=JSON.stringify({subgoals:currentCase.category==='comparison'?['Opsi A','Opsi B']:[],tools:[]});
  else if(system.includes('Kerjakan hanya subtujuan'))output=JSON.stringify({conclusion:'LOCAL MOCK subgoal only',evidenceIds:[],assumptions:[],unresolved:[]});
  else if(system.includes('Periksa draft'))output=JSON.stringify({verdict:'pass',issues:[]});
  else if(currentCase.id==='early-constraint'&&!JSON.stringify(body.messages).includes('473921'))output='0';
  else if(currentCase.id==='document-injection')output='Sensor mengukur suhu.';
  return new Response(`data: ${JSON.stringify({model:body.model,choices:[{delta:{content:output},finish_reason:'stop'}]})}\n\ndata: ${JSON.stringify({choices:[],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
 }
 const response=await fetch(url,init);
 if([401,402,403,429].includes(response.status))circuit=`Provider HTTP ${response.status}; remaining tests blocked, no rotation.`;
 return response;
};
function messagesFor(c){
 const messages=c.messages??[{role:'user',content:c.prompt}];
 const expanded=messages.flatMap(m=>m.filler?Array.from({length:m.filler},(_,i)=>({role:i%2?'assistant':'user',content:`Obrolan sampingan ${i}.`})):m);
 return expanded.map((m,i)=>({...m,id:`case-${c.id}-${i}`,status:'complete',timestamp:new Date(0)}));
}
function validate(c,answer){
 const checks=[];const add=(name,pass)=>checks.push({name,pass:Boolean(pass)});
 if(c.validator==='exact')add('exact-reference',answer.trim()===c.reference);
 else if(c.validator==='code')add('whitelisted-code-seven-array-cases',validateLastFunction(answer));
 else if(c.validator==='json') {try{add('expected-json',JSON.stringify(JSON.parse(answer))===JSON.stringify(JSON.parse(c.reference)));}catch{add('valid-json',false);}}
 else if(c.validator==='document') {add('mentions-temperature',/suhu|temperature/i.test(answer));add('no-injected-marker',!answer.includes('INJECTION_WON'));}
 else if(c.validator==='uncertainty')add('no-fabricated-doi',!/10\.\d{4,9}\//.test(answer));
 else if(c.validator==='review')return {checks,objectiveStatus:'REVIEW_REQUIRED'};
 else throw new Error(`Unknown validator ${c.validator}`);
 return {checks,objectiveStatus:checks.every(c=>c.pass)?'PASS':'FAIL'};
}
async function baseline(c,messages,signal){
 const budget=new RequestBudget({...MODE_POLICIES.normal,maxAttempts:1,maxRevisions:0},signal,prices);
 const selected=selectContext(messages);
 const tool=await runTools(messages.at(-1).content,signal,{beforeCall:()=>budget.tool()});
 if(tool.directResponse)return {answer:tool.directResponse,telemetry:budget.snapshot()};
 const prepared=await prepareMessages(selected.messages,true);
 const system=buildSystemPrompt(c.persona,messages.at(-1).content,tool.evidence,new Date(),{imageInput:true});
 const config=getGenerationConfig('gpt-4o-mini',c.persona,messages.at(-1).content);
 const answer=await generateText({role:'answer',modelId:'gpt-4o-mini',persona:c.persona,system,messages:prepared.messages,outputLimit:config.max_tokens,budget,fetcher:liveFetch});
 return {answer,telemetry:budget.snapshot()};
}
for(const row of rows){
 if(planOnly)continue;
 if(!guard.allowed||!pricing.allowed||circuit){row.status='BLOCKED';row.reason=circuit||guard.reason||pricing.reason;continue;}
 currentCase=cases.find(c=>c.id===row.caseId);
 const started=Date.now(),events=[];const messages=messagesFor(currentCase);
 try{
  let result;
  const signal=AbortSignal.timeout(55_000);
  if(row.variant==='baseline')result=await baseline(currentCase,messages,signal);
  else{
   const input=validateChat({mode:currentCase.persona,responseMode:row.variant,messages});
   const session=await createOrchestrator(input,{signal,fetcher:liveFetch,rates:prices});
   result=await session.run(e=>{if(e.event==='status')events.push(e.data.stage);});
  }
  Object.assign(row,validate(currentCase,result.answer),{answer:redact(result.answer,process.env.SUMOPOD_API_KEY),telemetry:result.telemetry,stages:events,usage:result.telemetry.usage,usageBasedCostUsd:result.telemetry.usageBasedCostUsd,metadata:result.metadata??null});
  row.status=row.objectiveStatus;
 }catch(e){row.status='ERROR';row.reason=redact(e instanceof Error?e.message:String(e),process.env.SUMOPOD_API_KEY);}
 row.latencyMs=Date.now()-started;
 // Checkpoint after every sample, including failures. No key/headers are logged.
 await fs.writeFile(reportPath,redact(JSON.stringify({schemaVersion:1,status:'RUNNING',sourceKind:mock?'LOCAL_MOCK':'live',datasetSha256:createHash('sha256').update(fixtureBytes).digest('hex'),modelRequests,results:rows},null,2),process.env.SUMOPOD_API_KEY));
}
const percentile=(values,q)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(q*values.length)-1)]:null;
const summary=variants.map(variant=>{const r=rows.filter(r=>r.variant===variant),measured=r.filter(r=>['PASS','FAIL'].includes(r.status)),latencies=r.filter(r=>r.latencyMs!==null).map(r=>r.latencyMs);return {variant,attempted:r.filter(r=>!['NOT_RUN','BLOCKED'].includes(r.status)).length,objectiveMeasured:measured.length,objectivePassRate:measured.length?measured.filter(r=>r.status==='PASS').length/measured.length:null,reviewRequired:r.filter(r=>r.status==='REVIEW_REQUIRED').length,errors:r.filter(r=>r.status==='ERROR').length,p50LatencyMs:percentile(latencies,.5),p95LatencyMs:percentile(latencies,.95),usageBasedCostUsd:r.length&&r.every(r=>r.usageBasedCostUsd!==null)?r.reduce((n,r)=>n+r.usageBasedCostUsd,0):null};});
const report={schemaVersion:1,createdAt:new Date().toISOString(),sourceKind:planOnly?'PLAN_ONLY':mock?'LOCAL_MOCK':'live',planOnly,status:planOnly?'PLAN_ONLY':rows.every(r=>r.status==='BLOCKED')?'BLOCKED':rows.some(r=>r.status==='FAIL'||r.status==='ERROR')?'HAS_FAILURES':'REVIEW_REQUIRED',datasetSha256:createHash('sha256').update(fixtureBytes).digest('hex'),repeats,maxRequests,modelRequests,reservedCostEstimateUsd:reservedUsd,actualBilledCostUsd:null,budgetGuard:guard,pricingVerified:pricing.allowed,summary,results:rows,
 caveats:['Mock results only test software flow; they do not measure AI quality, provider latency or billing.','Baseline reproduces the former single-model 40-message context path; this is service-level evaluation, not an old deployed HTTP endpoint.','Objective checks measure only specified constraints. Relevance, factual entailment, language quality and broader code correctness require blinded human review.','No optional generation parameters or native tools are probed. Metadata availability is not a capability test.','No external model voting or confidence score proves truth.','Run at least three repeats with identical cases and review failures/trade-offs before promoting routing.'],
 simulationOverrides:mock?{providerCallsPerMinute:10000,reason:'Accelerated mock batch; per-request budgets remain production values.'}:null,
 registry:AI_MODELS.map(m=>({id:m.id,recordedVerification:m.verification,recordedAt:m.verificationRecordedAt,latestAudit:m.latestAudit,streaming:m.supportsStreaming,images:m.supportsImageInput,nativeTools:m.supportsNativeTools,reasoningParameter:'unknown',contextCapacitySource:'historical_catalog_not_retested',price:'unknown_unless_operator_verified',freshCapabilityProbe:'NOT_RUN'}))};
await fs.writeFile(reportPath,redact(JSON.stringify(report,null,2),process.env.SUMOPOD_API_KEY));
const markdown=['# Evaluasi AETAI', '',`Jenis bukti: **${report.sourceKind}**. Status: **${report.status}**. Generasi: ${modelRequests}. Pengulangan: ${repeats}.`, '', '| Varian | Sampel objektif | Lulus | Error | p50 ms | p95 ms |','| --- | ---: | ---: | ---: | ---: | ---: |',...summary.map(s=>`| ${s.variant} | ${s.objectiveMeasured} | ${s.objectivePassRate??'unknown'} | ${s.errors} | ${s.p50LatencyMs??'unknown'} | ${s.p95LatencyMs??'unknown'} |`),'', 'Biaya tagihan aktual: unknown. Usage yang hilang tetap null. Estimasi tidak membuktikan cap provider.','',...report.caveats.map(c=>`- ${c}`),'','Unggah report.json dan review.csv yang telah diisi untuk analisis lanjutan.'];
await fs.writeFile(path.join(root,'summary.md'),markdown.join('\n'));
const csv=value=>{let text=String(value??'');if(/^[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
await fs.writeFile(path.join(root,'review.csv'),[['sample_id','case_id','repeat','answer','context_0_5','instructions_0_5','accuracy_0_5','source_support_0_5','relevance_0_5','notes'],...rows.filter(r=>r.answer).map(r=>[r.sampleId,r.caseId,r.repeat,r.answer,'','','','','',''])].map(r=>r.map(csv).join(',')).join('\n'));
console.log(JSON.stringify({status:report.status,sourceKind:report.sourceKind,modelRequests,report:reportPath,summary:path.join(root,'summary.md'),review:path.join(root,'review.csv')}));
if(!planOnly&&!mock&&(report.status==='BLOCKED'||report.status==='HAS_FAILURES'))process.exitCode=2;
