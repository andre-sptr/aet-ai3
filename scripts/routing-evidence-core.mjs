/** Offline screening audit. Never fetches a provider or executes generated code
 * outside benchmark-core's existing, fully matched safe function grammar. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { AI_MODELS } from '../lib/ai-models.ts';
import { buildSystemPrompt } from '../lib/ai/personas/prompt-builder.ts';
import { buildSumopodChatRequest } from '../lib/sumopod.ts';
import { evaluateOutput } from './benchmark-core.mjs';

export const FINAL_SCREENING_REPORT='docs/benchmarks/run-2026-10-25T07-48-50-786Z-6888c026/report.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const counts=values=>Object.fromEntries([...new Set(values)].map(v=>[v,values.filter(x=>x===v).length]));
const check=(ok,message)=>{if(!ok)throw new Error(message);};
export async function auditScreeningReport(file=FINAL_SCREENING_REPORT) {
  const datasetRef='tests/fixtures/all-model-benchmark.json';
  const dataset=JSON.parse(await fs.readFile(datasetRef,'utf8'));
  const datasetSha256=hash(JSON.stringify(dataset)), lineage=[], visited=new Set();
  async function read(ref) {
    ref=ref.replaceAll('\\','/');
    check(/^docs\/benchmarks\/[\w./-]+\.json$/.test(ref)&&!ref.includes('..'),'Unsafe report reference.');
    check(!visited.has(ref),'Cyclic resume lineage.'); visited.add(ref);
    const bytes=await fs.readFile(ref), report=JSON.parse(bytes.toString('utf8'));
    check(report.schemaVersion===2 && report.sourceKind==='live','Only live schema-v2 screening reports are audited.');
    check(report.datasetSha256===datasetSha256,'Dataset mismatch.');
    check(isDeepStrictEqual(report.models.map(m=>m.id),AI_MODELS.map(m=>m.id)),'Catalogue mismatch.');
    check(report.results.length===AI_MODELS.length*dataset.length,'Incomplete result matrix.');
    const unique=new Set(report.results.map(r=>`${r.model}:${r.caseId}`));
    check(unique.size===report.results.length,'Duplicate model/case cell.');
    check(report.results.every(r=>AI_MODELS.some(m=>m.id===r.model)&&dataset.some(c=>c.id===r.caseId)),'Unknown model/case.');
    const prompt=hash(['daily','report','coding'].map(mode=>buildSystemPrompt(mode,'',[],new Date(report.checkedAt))).join('\n'));
    check(report.productionPromptSha256===prompt,'Production persona fingerprint mismatch.');
    let parent;
    if(report.resume) {
      parent=await read(report.resume.sourceFile);
      check(parent.sha256===report.resume.sourceSha256,'Resume source hash mismatch.');
      check(parent.report.datasetSha256===report.datasetSha256 && parent.report.productionPromptSha256===report.productionPromptSha256
        && parent.report.checkedAt===report.checkedAt && parent.report.requestedOutputCap===report.requestedOutputCap,'Resume protocol mismatch.');
      const retained=parent.report.results.filter(r=>r.attempted);
      check(report.resume.retainedAttempts===retained.length && report.resume.pendingAtStart===report.results.length-retained.length,'Resume counters mismatch.');
      for(const row of retained)check(isDeepStrictEqual(row,report.results.find(r=>r.model===row.model&&r.caseId===row.caseId)),'Inherited outcome was changed.');
      check(report.resume.sourceRevision===parent.report.sourceRevision,'Resume source revision mismatch.');
    }
    const attempted=report.results.filter(r=>r.attempted), stopped=attempted.filter(r=>r.finishReason==='stop');
    check(report.modelRequests===attempted.length && report.completedRequests===stopped.length,'Request counters disagree with rows.');
    check(report.usageUnknownRequests===attempted.filter(r=>r.usage?.total_tokens===undefined).length,'Unknown usage counter mismatch.');
    check(report.recordedTokens===attempted.reduce((n,r)=>n+(r.usage?.total_tokens??0),0),'Reported token counter mismatch.');
    for(const row of report.results) {
      const c=dataset.find(c=>c.id===row.caseId), model=AI_MODELS.find(m=>m.id===row.model);
      const system=buildSystemPrompt(c.mode,c.prompt,[],new Date(report.checkedAt),{imageInput:model.supportsImageInput===true});
      const expected=JSON.parse(buildSumopodChatRequest({apiKey:'offline-unused',modelId:row.model,mode:c.mode,systemInstruction:system,
        messages:[...(c.history||[]),{role:'user',content:c.prompt}],inputText:c.prompt,maxTokens:report.requestedOutputCap,stream:true}).init.body);
      check(isDeepStrictEqual(row.request.body,expected),'Actual request differs from fixture/production generation config.');
      if(!row.attempted){check(row.status==='BLOCKED' && row.output===null,'Unattempted cell contains a result.');continue;}
      if(row.finishReason==='length'){check(row.status==='FAIL','Truncated response was not marked failed.');continue;}
      check(row.httpStatus===200 && row.reportedModel===row.model && row.finishReason==='stop','Unrecognized transport result.');
      const evaluated=evaluateOutput(c,row.output);
      const status=evaluated.objectiveStatus==='FAIL'?'FAIL':evaluated.qualitativeReview==='REQUIRED'?'INCONCLUSIVE':'PASS';
      check(evaluated.objectiveStatus===row.objectiveStatus && status===row.status && isDeepStrictEqual(evaluated.checks,row.checks),'Validator status differs from raw output.');
    }
    const entry={ref,sha256:hash(bytes),sourceKind:report.sourceKind,planOnly:report.planOnly,checkedAt:report.checkedAt,finishedAt:report.finishedAt??null,
      sourceRevision:report.sourceRevision,datasetSha256:report.datasetSha256,productionPromptSha256:report.productionPromptSha256,
      planned:report.plannedRequests,scheduled:report.scheduledRequests,attempted:attempted.length,technicalStops:stopped.length,statuses:counts(report.results.map(r=>r.status)),
      newAttempts:report.planOnly?0:attempted.length-(report.resume?.retainedAttempts??0),retainedAttempts:report.resume?.retainedAttempts??0,
      legacyKeyBinding:report.resume?.legacyKeyBinding??null};
    lineage.push(entry);
    return {report,sha256:entry.sha256};
  }
  const {report,sha256}=await read(file);
  check(report.planOnly===false && Number.isFinite(Date.parse(report.finishedAt)),'Final live run has not finished.');
  check(report.results.every(r=>r.attempted),'Final run still has unattempted cells.');
  const cases=dataset.map(c=>{
    const rows=report.results.filter(r=>r.caseId===c.id);
    return {caseId:c.id,category:c.category,persona:c.mode,n:rows.length,statuses:counts(rows.map(r=>r.status)),
      objectivePass:rows.filter(r=>r.objectiveStatus==='PASS').length,objectiveFail:rows.filter(r=>r.objectiveStatus==='FAIL').length,
      objectiveNotScored:rows.filter(r=>r.objectiveStatus==null).length,technicalStops:rows.filter(r=>r.finishReason==='stop').length,
      truncated:rows.filter(r=>r.finishReason==='length').length,humanReviewRequired:rows.filter(r=>r.qualitativeReview==='REQUIRED').length};
  });
  const models=report.models.map(model=>{
    const rows=report.results.filter(r=>r.model===model.id);
    return {modelId:model.id,accessPolicy:model.accessPolicy,n:rows.length,statuses:counts(rows.map(r=>r.status)),
      cases:rows.map(r=>({caseId:r.caseId,status:r.status,objectiveStatus:r.objectiveStatus??null,finishReason:r.finishReason,
        durationMs:r.durationMs,actualOutputCap:r.request.body.max_tokens??r.request.body.max_completion_tokens,
        parameter:r.request.body.max_completion_tokens!==undefined?'max_completion_tokens':'max_tokens',
        partialWeightCoverage:r.partialComposite.weightCoverage,measuredDimensions:r.partialComposite.measuredDimensions,
        evidence:{reportRef:file,modelId:r.model,caseId:r.caseId}}))};
  });
  const failures=report.results.filter(r=>r.status==='FAIL').map(r=>{
    let kind=r.finishReason==='length'?'truncation':r.caseId==='reasoning-conflicting-information'?'raw_json_format':'wrong_answer';
    let semanticJsonMatches=null;
    if(kind==='raw_json_format') {
      try {const data=JSON.parse(r.output.replace(/^```(?:json)?\s*|\s*```$/g,''));semanticJsonMatches=data.status==='tidak_dapat_dipastikan' && data.persentase===null && Object.keys(data).sort().join(',')==='persentase,status';}catch{semanticJsonMatches=false;}
    }
    return {modelId:r.model,caseId:r.caseId,kind,semanticJsonMatches,originalStatus:r.status};
  });
  return {schemaVersion:1,kind:'screening-audit',productionStatus:'pending',reportRef:file,reportSha256:sha256,datasetRef,datasetSha256,
    productionPromptSha256:report.productionPromptSha256,finishedAt:report.finishedAt,sourceKind:report.sourceKind,planOnly:report.planOnly,
    uniqueAttempts:report.results.length,statuses:counts(report.results.map(r=>r.status)),httpStatuses:counts(report.results.map(r=>r.httpStatus)),
    reportedIdentityMatches:report.results.filter(r=>r.model===r.reportedModel).length,finishReasons:counts(report.results.map(r=>r.finishReason)),
    usageUnknownRequests:report.usageUnknownRequests,recordedTokens:report.recordedTokens,actualCostUsd:report.actualCostUsd,
    usageCaveat:'Missing usage is not zero usage or zero billing; no token throughput can be computed.',lineage,cases,models,failures,
    promotionBlockers:['One observation per model/case; no independent repetitions.','Daily/report qualitative human review missing.',
      'Usage and measured costs absent.','Direct gateway screening is not application/role calibration.',
      'No vision, native tool, long-context or planner/worker/verifier/revision calibration.'],
    identityCaveat:'Only gateway-reported exact model IDs were checked; backend model identity is not independently verified.'};
}
export async function benchmarkInventory() {
  const root='docs/benchmarks', files=[];
  for(const dir of await fs.readdir(root,{withFileTypes:true})) {
    if(!dir.isDirectory()||!dir.name.startsWith('run-'))continue;
    for(const name of await fs.readdir(path.join(root,dir.name))) {
      if(!/^report.*\.(?:json|md|tmp)$/.test(name))continue;
      const ref=`${root}/${dir.name}/${name}`, bytes=await fs.readFile(ref);
      let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{/* Markdown is a companion, not structured evidence. */}
      files.push({ref,sha256:hash(bytes),bytes:bytes.length,...(value?{planOnly:value.planOnly,sourceKind:value.sourceKind,
        checkedAt:value.checkedAt,finishedAt:value.finishedAt??null,sourceRevision:value.sourceRevision,
        attempted:value.results?.filter(r=>r.attempted).length,statuses:counts(value.results?.map(r=>r.status)??[])}:{})});
    }
  }
  return files.sort((a,b)=>a.ref.localeCompare(b.ref));
}
