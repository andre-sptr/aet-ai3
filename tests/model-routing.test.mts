import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTask, routeModel } from '../lib/ai/model-router.ts';
import type { RoutingEvidence, RoutingInput, RoutingPolicy } from '../lib/ai/model-router.ts';
import { configuredRoutingMode, loadRoutingPolicy } from '../lib/ai/routing-policy.ts';

const now = Date.parse('2026-10-22T05:00:00Z');
const input: RoutingInput = { mode:'daily',text:'Jelaskan RAM',contextChars:200 };
// Synthetic policy metrics test decision rules only; no claim about actual models.
const evidence = (modelId: string): RoutingEvidence => ({ modelId,category:'daily',sourceKind:'live',
  reportRef:'docs/benchmarks/synthetic/report.json',comparisonSet:'b'.repeat(64),caseIds:['a','b','c'],sampleCount:3,verifiedAt:new Date(now-1000).toISOString(),
  objectivePassRate:1,contextPassRate:1,instructionPassRate:1,streamingSuccessRate:1,
  qualitativeReview:{status:'approved',reviewer:'synthetic fixture',score:4.5},p95LatencyMs:300,costUsdPerRequest:0.001,costVerified:true,maxTestedInputChars:1000 });
const policy = (): RoutingPolicy => ({schemaVersion:1,datasetSha256:'a'.repeat(64),maxLatencyMs:5000,maxCostUsdPerRequest:0.01,
  evidence:[{...evidence('gpt-4o-mini'),costUsdPerRequest:0.002},evidence('gpt-4.1-mini')]});

test('routing classifies six supported tasks using direct intent and context size',()=>{
  assert.equal(classifyTask(input),'daily');
  assert.equal(classifyTask({...input,mode:'report'}),'academic');
  assert.equal(classifyTask({...input,mode:'coding'}),'coding');
  assert.equal(classifyTask({...input,text:'Selesaikan kendala jadwal'}),'reasoning');
  assert.equal(classifyTask({...input,hasDocument:true}),'long-context');
  assert.equal(classifyTask({...input,text:''}),'uncertain');
});
test('default/off, missing evidence, and shadow never change the default or call a model',()=>{
  assert.equal(routeModel(input).modelId,'gpt-4o-mini');
  assert.equal(routeModel(input,'adaptive').reason,'insufficient_evidence');
  assert.equal(routeModel(input,'shadow',policy(),now).modelId,'gpt-4o-mini');
  assert.equal(routeModel(input,'shadow',policy(),now).recommendedModelId,'gpt-4.1-mini');
  assert.equal(routeModel(input,'adaptive',policy(),now).modelId,'gpt-4.1-mini');
});
test('legacy client selections cannot override server policy, including Frontier and retired IDs',()=>{
  for(const mode of ['off','shadow','adaptive'] as const)for(const model of ['gpt-4o-mini','gpt-5.4','retired-id']){
    const result=routeModel({...input,manualModelId:model},mode,policy(),now);
    assert.equal(result.modelId, mode === 'adaptive' ? 'gpt-4.1-mini' : 'gpt-4o-mini');assert.notEqual(result.reason,'manual_selection');
  }
});
test('unknown, mock, stale, mismatched, undersampled, costly and unreviewed candidates never promote',()=>{
  for(const patch of [
    {modelId:'unknown'},{sourceKind:'LOCAL_MOCK'},{verifiedAt:'2000-01-01'},
    {verifiedAt:new Date(now+1).toISOString()},{comparisonSet:'c'.repeat(64)},
    {sampleCount:1},{caseIds:['a']},{caseIds:['a','a','a']},{costVerified:false},
    {costUsdPerRequest:2},{costUsdPerRequest:NaN},{p95LatencyMs:90000},
    {objectivePassRate:0.8},{contextPassRate:0.5},{instructionPassRate:0.5},{streamingSuccessRate:0.9},
    {maxTestedInputChars:199},{qualitativeReview:{status:'required',reviewer:'',score:5}},
  ]){
    const p=policy();p.evidence[1]={...p.evidence[1],...patch} as RoutingEvidence;
    assert.equal(routeModel(input,'adaptive',p,now).modelId,'gpt-4o-mini',JSON.stringify(patch));
  }
});
test('Frontier gate, image capability, context length, and category all restrict candidates',()=>{
  const p=policy();p.evidence[1]={...p.evidence[1],modelId:'gpt-5.4'};
  assert.equal(routeModel(input,'adaptive',p,now).modelId,'gpt-4o-mini');
  assert.equal(routeModel({...input,frontierAllowed:true},'adaptive',p,now).modelId,'gpt-5.4');
  assert.equal(routeModel({...input,frontierAllowed:true,hasImages:true},'adaptive',p,now).modelId,'gpt-4o-mini');
  assert.equal(routeModel({...input,contextChars:24000},'adaptive',p,now).reason,'insufficient_evidence');
  assert.equal(routeModel({...input,mode:'coding'},'adaptive',p,now).reason,'insufficient_evidence');
});
test('no promotion without comparable default, safe policy loader and invalid flags fail closed',async()=>{
  const p=policy();p.evidence.shift();assert.equal(routeModel(input,'adaptive',p,now).reason,'insufficient_evidence');
  assert.equal(configuredRoutingMode('yes'),'off');assert.equal(configuredRoutingMode('shadow'),'shadow');
  assert.equal(await loadRoutingPolicy('/nonexistent/aet-routing.json'),undefined);
  const result=routeModel({...input,text:'secret conversation text'},'shadow',policy(),now);
  assert.doesNotMatch(JSON.stringify(result),/secret conversation/);
});
