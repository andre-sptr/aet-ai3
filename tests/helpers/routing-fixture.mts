// All "live"/human labels in this helper are deliberately synthetic contract
// inputs. They test software validation only and are removed after each test.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {calibrationSource} from '../../lib/ai/calibration-source.ts';
import {estimateInput} from '../../lib/ai/budget.ts';
import {evaluateApplicationOutput} from '../../lib/ai/evaluation-checks.ts';
export const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function calibrationFixture(options:{baselineFails?:boolean}={}) {
 const directory=await mkdtemp(path.join(process.cwd(),'docs/benchmarks/calibration-test-'));
 const datasetRef=`tests/fixtures/calibration-${randomUUID()}.json`;
 const dataset=[...['a','b','c'].map(id=>({id,category:'stable',persona:'daily' as const,prompt:`Jelaskan RAM ${id}. `+'Berikan jawaban sesuai format yang diminta. '.repeat(20),validator:'exact',reference:'fixture'})),
  {id:'context',category:'context',persona:'daily' as const,prompt:'Koreksi anggaran menjadi 900000. Jawab angkanya saja.',validator:'exact',reference:'900000'}];
 const datasetBytes=JSON.stringify(dataset),datasetSha256=hash(datasetBytes);
 await writeFile(datasetRef,datasetBytes);
 const checkedAt=new Date(Date.now()-10_000).toISOString(),finishedAt=new Date(Date.now()-5_000).toISOString();
 const models=['gpt-4o-mini','gpt-4.1-mini'];
 const results=models.flatMap(model=>dataset.flatMap(c=>[1,2,3].map(repeat=>{
  const answer=options.baselineFails&&model===models[0]?'WRONG':c.reference;
  const evaluated=evaluateApplicationOutput(c,answer);
  const body={model,messages:[{role:'system',content:'SYNTHETIC VALIDATION ONLY. '+'x'.repeat(11_000)},{role:'user',content:c.prompt}],max_tokens:4096,stream:true};
  const attempt={role:'answer',model,inputEstimate:estimateInput(body.messages),outputLimit:4096,status:'complete',usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120},estimatedCeilingUsd:1,usageBasedCostUsd:null,reportedModel:model,durationMs:model===models[0]?400:200};
  return {sampleId:`${model}-${c.id}-${repeat}`,caseId:c.id,repeat,variant:'normal',persona:'daily',status:evaluated.objectiveStatus,answer,...evaluated,
   latencyMs:attempt.durationMs,metadata:{responseOrigin:'gateway',requestedModel:model,model,reportedModel:model,modelIdentity:'reported_match'},
   providerRequests:[{body,httpStatus:200}],telemetry:{attempts:[attempt],toolCalls:0}};
 })));
 const report={schemaVersion:2,kind:'application-evaluation',repeats:3,fixtureNotice:'SYNTHETIC TEST ONLY; no model capabilities or human approvals asserted.',
  sourceKind:'live',planOnly:false,checkedAt,finishedAt,...await calibrationSource(),datasetSha256,budgetGuard:{allowed:true,keyBound:true},
  pricing:{operatorVerified:true,sourceUrl:'https://sumopod.com/ai',verifiedAt:new Date(Date.now()-20_000).toISOString(),models:Object.fromEntries(models.map(id=>[id,{inputUsdPerMillion:1,outputUsdPerMillion:2}]))},results};
 const reportRef=path.relative(process.cwd(),path.join(directory,'report.json')).replaceAll('\\','/');
 const reportBytes=JSON.stringify(report);await writeFile(reportRef,reportBytes);
 const reviews=models.map(model=>({authorKind:'human',status:'completed',reviewer:'SYNTHETIC FIXTURE, NOT A HUMAN APPROVAL',reviewedAt:new Date(Date.now()-1000).toISOString(),reportSha256:hash(reportBytes),datasetSha256,modelId:model,
  samples:results.filter(s=>s.metadata.model===model).map(s=>({sampleId:s.sampleId,quality:options.baselineFails&&model===models[0]?1:4.5,instructions:options.baselineFails&&model===models[0]?1:5}))}));
 const evidence=[];
 for(let i=0;i<models.length;i++) {
  const ref=path.relative(process.cwd(),path.join(directory,`review-${i}.json`)).replaceAll('\\','/'),bytes=JSON.stringify(reviews[i]);await writeFile(ref,bytes);
  evidence.push({modelId:models[i],category:'daily',persona:'daily',complexity:'simple',responseMode:'normal',caseIds:['a','b','c'],contextCaseIds:['context'],report:{ref:reportRef,sha256:hash(reportBytes)},review:{ref,sha256:hash(bytes)}});
 }
 const policy={schemaVersion:2,status:'active',version:'SYNTHETIC-VALIDATION-ONLY',dataset:{ref:datasetRef,sha256:datasetSha256},maxLatencyMs:5000,maxCostUsdPerRequest:0.01,evidence};
 let sequence=0;
 const writePolicy=async()=>{const file=path.join(directory,`policy-${sequence++}.json`);await writeFile(file,JSON.stringify(policy));return file;};
 return {directory,dataset,datasetRef,report,reportRef,reviews,policy,file:await writePolicy(),writePolicy,
  cleanup:async()=>{await rm(directory,{recursive:true,force:true});await rm(datasetRef,{force:true});}};
}
