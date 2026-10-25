import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTask,routeModel} from '../lib/ai/model-router.ts';
import type {RoutingEvidence,RoutingInput,RoutingPolicy} from '../lib/ai/model-router.ts';
import {configuredRoutingMode,loadRoutingPolicy,inspectRoutingPolicy} from '../lib/ai/routing-policy.ts';
import {analyzeTask} from '../lib/ai/task-analysis.ts';
import {deriveConversationState} from '../lib/ai/conversation-state.ts';
import {calibrationFixture,hash} from './helpers/routing-fixture.mts';
import {writeFile,readFile} from 'node:fs/promises';
import type {Message} from '../types/index.ts';

const now=Date.parse('2026-10-25T09:00:00Z');
const input:RoutingInput={mode:'daily',text:'Jelaskan RAM',contextChars:200};
const evidence=(modelId:string):RoutingEvidence=>({modelId,category:'daily',sourceKind:'live',reportRef:'docs/benchmarks/synthetic/report.json',
 comparisonSet:'b'.repeat(64),caseIds:['a','b','c'],sampleCount:9,independentRepeats:3,verifiedAt:new Date(now-1000).toISOString(),provenanceValidated:true,
 objectivePassRate:1,contextPassRate:1,instructionPassRate:1,streamingSuccessRate:1,qualitativeReview:{status:'completed',authorKind:'human',reviewer:'SYNTHETIC TEST ONLY',score:4.5},
 p95LatencyMs:modelId==='gpt-4o-mini'?400:200,costUsdPerRequest:0.001,costVerified:true,maxTestedInputChars:1000,maxTestedInputTokens:20_000,maxTestedOutputTokens:4096,
 scope:{role:'answer',persona:'daily',complexity:'simple',responseMode:'normal',documents:false,images:false,toolEvidence:false,longContext:false}});
const policy=():RoutingPolicy=>({schemaVersion:2,version:'synthetic',datasetSha256:'a'.repeat(64),maxLatencyMs:5000,maxCostUsdPerRequest:0.01,evidence:[evidence('gpt-4o-mini'),evidence('gpt-4.1-mini')]});

test('task intent survives documents/large history and follows direct requests across personas',()=>{
 assert.equal(classifyTask(input),'daily');assert.equal(classifyTask({...input,mode:'report'}),'academic');
 assert.equal(classifyTask({...input,mode:'coding',hasDocument:true}),'coding');
 assert.equal(classifyTask({...input,text:'Tinjau penelitian ini',hasDocument:true}),'academic');
 assert.equal(classifyTask({...input,text:'Selesaikan kendala jadwal',contextChars:50000}),'reasoning');
 assert.equal(classifyTask({...input,mode:'report',text:'Debug TypeScript ini'}),'coding');
 assert.equal(classifyTask({...input,text:''}),'uncertain');
 const d=routeModel({...input,text:'Perbaiki kode',hasDocument:true,contextChars:25000});
 assert.equal(d.category,'coding');assert.equal(d.needs.documents,true);assert.equal(d.needs.longContext,true);
});
test('followups and latest corrections inherit user task; a new topic discards old coding keywords',()=>{
 const msg=(id:string,content:string,role:Message['role']='user'):Message=>({id,content,role,timestamp:new Date(0)});
 for(const latest of ['Lanjutkan','Koreksi: gunakan pendekatan yang kedua','Perbaiki bagian tadi']){
  const m=[msg('a','Debug kode TypeScript'),msg('b','Saran penelitian akademik','assistant'),msg('c',latest)];
  const task=analyzeTask(m,deriveConversationState(m),'daily');
  assert.equal(classifyTask({...input,text:task.intentText,latestText:task.latest,previousTaskText:task.previousTaskText,continuesTask:task.followup}),'coding');
 }
 const m=[msg('a','Debug kode TypeScript'),msg('b','Sekarang apa kepanjangan RAM?')],task=analyzeTask(m,deriveConversationState(m),'daily');
 assert.equal(classifyTask({...input,text:task.intentText,latestText:task.latest,continuesTask:task.followup}),'daily');
});
test('off, missing evidence and shadow are deterministic and do not execute candidates',()=>{
 assert.equal(routeModel(input).modelId,'gpt-4o-mini');assert.equal(routeModel(input,'adaptive').reason,'insufficient_evidence');
 const shadow=routeModel(input,'shadow',policy(),now);assert.equal(shadow.modelId,'gpt-4o-mini');assert.equal(shadow.recommendedModelId,'gpt-4.1-mini');
 assert.equal(shadow.calibration,'uncalibrated_baseline');
 assert.equal(routeModel(input,'adaptive',policy(),now).modelId,'gpt-4.1-mini');
 assert.deepEqual(routeModel(input,'adaptive',policy(),now),routeModel(input,'adaptive',policy(),now));
});
test('failed-quality or unhealthy baseline remains a comparator; candidates retain every quality gate',()=>{
 const p=policy();p.evidence[0]={...p.evidence[0],objectivePassRate:0,contextPassRate:0,instructionPassRate:null,qualitativeReview:null,costVerified:false,costUsdPerRequest:null};
 assert.equal(routeModel(input,'adaptive',p,now).modelId,'gpt-4.1-mini');
 assert.equal(routeModel({...input,unavailableModelIds:['gpt-4o-mini']},'adaptive',p,now).modelId,'gpt-4.1-mini');
 p.evidence[1].objectivePassRate=.8;assert.equal(routeModel(input,'adaptive',p,now).modelId,'gpt-4o-mini');
 assert.equal(routeModel({...input,unavailableModelIds:['gpt-4o-mini']},'adaptive',p,now).modelId,null);
});
test('unproven, stale, mismatched, costly, short or unreviewed candidates never promote',()=>{
 for(const patch of [{modelId:'unknown'},{sourceKind:'LOCAL_MOCK'},{verifiedAt:'2000-01-01'}, {verifiedAt:new Date(now+1).toISOString()},
  {comparisonSet:'c'.repeat(64)},{sampleCount:1},{independentRepeats:1},{caseIds:['a']},{caseIds:['a','a','a']},{provenanceValidated:false},
  {costVerified:false},{costUsdPerRequest:null},{costUsdPerRequest:2},{costUsdPerRequest:NaN},{p95LatencyMs:90000},
  {objectivePassRate:.8},{contextPassRate:.5},{instructionPassRate:null},{instructionPassRate:.5},{streamingSuccessRate:.9},
  {maxTestedInputChars:199},{qualitativeReview:null},{qualitativeReview:{status:'completed',authorKind:'ai',reviewer:'AI',score:5}}]) {
  const p=policy();p.evidence[1]={...p.evidence[1],...patch} as RoutingEvidence;
  assert.equal(routeModel(input,'adaptive',p,now).modelId,'gpt-4o-mini',JSON.stringify(patch));
 }
});
test('Frontier, images, documents, roles, mode, context/output, health and budgets constrain every choice including baseline',()=>{
 const p=policy();p.evidence[1].modelId='gpt-5.4';
 assert.equal(routeModel(input,'adaptive',p,now).modelId,'gpt-4o-mini');
 assert.equal(routeModel({...input,frontierAllowed:true},'adaptive',p,now).modelId,'gpt-5.4');
 for(const extra of [{hasImages:true},{hasDocument:true},{hasToolEvidence:true},{complexity:'complex' as const},{role:'verifier' as const},{responseMode:'think' as const},{contextChars:24000}, {inputTokensEstimate:20001},{outputTokens:4097},{remainingMs:100}]) {
  assert.equal(routeModel({...input,...extra,frontierAllowed:true},'adaptive',p,now).modelId,'gpt-4o-mini');
 }
 for(const mode of ['off','shadow','adaptive'] as const) {
  assert.equal(routeModel({...input,unavailableModelIds:['gpt-4o-mini','gpt-5.4']},mode,p,now).modelId,null);
  assert.equal(routeModel({...input,canUseModel:()=>false},mode,p,now).reason,'no_eligible_model');
  assert.equal(routeModel({...input,inputTokensEstimate:128001},mode,p,now).modelId,null);
 }
 const shadow=routeModel({...input,frontierAllowed:true,unavailableModelIds:['gpt-4o-mini']},'shadow',p,now);
 assert.equal(shadow.modelId,null);assert.equal(shadow.recommendedModelId,'gpt-5.4');
});
test('client manual IDs cannot override selection; decision metadata contains no user content',()=>{
 for(const mode of ['off','shadow','adaptive'] as const)for(const id of ['gpt-5.4','retired-id'])assert.equal(routeModel({...input,manualModelId:id},mode,policy(),now).modelId,mode==='adaptive'?'gpt-4.1-mini':'gpt-4o-mini');
 const p=policy();p.evidence.shift();assert.equal(routeModel(input,'adaptive',p,now).reason,'insufficient_evidence');
 assert.doesNotMatch(JSON.stringify(routeModel({...input,text:'SECRET CONTENT'},'shadow',policy(),now)),/SECRET CONTENT/);
 assert.equal(configuredRoutingMode('yes'),'off');assert.equal(configuredRoutingMode('shadow'),'shadow');
});

test('v2 loader derives metrics, accepts a failed baseline comparator, and rejects legacy self-asserted metrics',async()=>{
 const f=await calibrationFixture({baselineFails:true});
 try {
  const loaded=await inspectRoutingPolicy(f.file);assert.deepEqual(loaded.rejected,[]);assert.equal(loaded.policy!.evidence.length,2);
  assert.equal(loaded.policy!.evidence[0].objectivePassRate,0);assert.equal(loaded.policy!.evidence[1].sampleCount,9);
  assert.ok(Math.abs(loaded.policy!.evidence[1].costUsdPerRequest!-.00014)<1e-12);
  assert.equal(routeModel(input,'adaptive',loaded.policy).modelId,'gpt-4.1-mini');
  await writeFile(f.file,JSON.stringify({...policy(),schemaVersion:1}));
  assert.equal((await inspectRoutingPolicy(f.file)).policy,undefined);
  assert.equal(await loadRoutingPolicy('/nonexistent/aet-routing.json'),undefined);
 } finally {await f.cleanup();}
});
test('loader rejects altered dataset/report bytes, invented metrics, mocks, plans, stale sources and duplicated repeats',async()=>{
 const f=await calibrationFixture();
 try {
  const original=JSON.parse(JSON.stringify(f.report));
  const reject=async(patch:(report:typeof f.report)=>void,validCount=0)=>{
   const report=JSON.parse(JSON.stringify(original));patch(report);const bytes=JSON.stringify(report);await writeFile(f.reportRef,bytes);
   for(const e of f.policy.evidence){e.report.sha256=hash(bytes);delete (e as {review?:unknown}).review;}
   const result=await inspectRoutingPolicy(await f.writePolicy());assert.equal(result.policy?.evidence.length??0,validCount);
   assert.equal(routeModel(input,'adaptive',result.policy).modelId,'gpt-4o-mini');
  };
  await reject(r=>{r.sourceKind='LOCAL_MOCK';});await reject(r=>{r.planOnly=true;});await reject(r=>{r.kind='screening';});
  await reject(r=>{r.pipelineSha256='f'.repeat(64);});await reject(r=>{r.productionPromptSha256='f'.repeat(64);});
  await reject(r=>{r.datasetSha256='f'.repeat(64);});await reject(r=>{r.checkedAt='2000-01-01';});
  await reject(r=>{r.results[0].answer='WRONG';},1);await reject(r=>{r.results.push(r.results[0]);},1);
  await reject(r=>{r.results.forEach(s=>{s.repeat=1;});});await reject(r=>{r.results[0].telemetry.attempts[0].inputEstimate=1;},1);
  // A whole failed repeat without final model metadata must not disappear from
  // the denominator when three other repeats have complete metadata.
  await reject(r=>{r.repeats=4;});
  await writeFile(f.reportRef,JSON.stringify(original));
  await writeFile(f.datasetRef,(await readFile(f.datasetRef,'utf8'))+' ');
  assert.equal((await inspectRoutingPolicy(await f.writePolicy())).policy,undefined);
 } finally {await f.cleanup();}
});
test('missing usage, review, capability extent or unmeasured category remains visible without fabricated zero cost',async()=>{
 const f=await calibrationFixture();
 try {
  const r=JSON.parse(JSON.stringify(f.report));r.results.forEach((s:{telemetry:{attempts:{usage:unknown}[]}})=>{s.telemetry.attempts[0].usage=null;});
  const bytes=JSON.stringify(r);await writeFile(f.reportRef,bytes);
  for(const e of f.policy.evidence){e.report.sha256=hash(bytes);delete (e as {review?:unknown}).review;}
  const p=(await inspectRoutingPolicy(await f.writePolicy())).policy!;
  assert.equal(p.evidence.length,2);assert.equal(p.evidence[1].costUsdPerRequest,null);assert.equal(p.evidence[1].instructionPassRate,null);
  assert.equal(routeModel(input,'adaptive',p).modelId,'gpt-4o-mini');
  assert.equal(routeModel({...input,mode:'coding'},'adaptive',p).reason,'insufficient_evidence');
 } finally {await f.cleanup();}
});
