/** Offline forensic comparison. Reads historical bytes; never writes to them. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AI_MODELS } from '../lib/ai-models.ts';
import { buildSumopodChatRequest } from '../lib/sumopod.ts';
import { buildSystemPrompt } from '../lib/ai/personas/prompt-builder.ts';
import { calibrationSource } from '../lib/ai/calibration-source.ts';
import { evaluateOutput, estimateRequestCost } from './benchmark-core.mjs';
import { assessScreening, screeningSummary, dimensionMarkdown, usageState, usageCost } from './benchmark-dimensions.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const input=option('--report','docs/benchmarks/run-2026-10-25T11-17-41-534Z-6f4ddf0d/report.json');
const root=path.resolve(option('--out',`evaluation/analysis-${Date.now()}`));
if((await fs.stat(input)).size>16_000_000)throw new Error('Historical report exceeds analysis bound.');
const bytes=await fs.readFile(input),report=JSON.parse(bytes.toString('utf8'));
if(report.schemaVersion!==2||!Array.isArray(report.results)||report.results.length>10000||!Array.isArray(report.models))throw new Error('Expected a bounded schema-v2 gateway screening report.');
const cases=JSON.parse(await fs.readFile('tests/fixtures/all-model-benchmark.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const counts=values=>Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(x=>x===v).length]));
const audit=[],add=(name,pass,observed)=>audit.push({name,pass:Boolean(pass),observed});
const unique=new Set(report.results.map(r=>r.model+':'+r.caseId));
add('unique-model-case-pairs',unique.size===report.results.length,unique.size);
add('catalog-exact-ids',isDeepStrictEqual(report.models.map(m=>m.id),AI_MODELS.map(m=>m.id)),report.models.map(m=>m.id));
add('complete-matrix',report.results.length===AI_MODELS.length*cases.length,report.results.length);
add('dataset-hash',report.datasetSha256===sha(JSON.stringify(cases)),sha(JSON.stringify(cases)));
let requestMatches=0,validatorMatches=0,completed=0,known=0,tokens=0,reserved=0;
const rows=[];
for(const r of report.results){
  const c=cases.find(c=>c.id===r.caseId);
  if(!c||!AI_MODELS.some(m=>m.id===r.model)||typeof r.output!=='string'&&r.output!==null)throw new Error('Unrecognized historical row; source is untrusted.');
  const actual=buildSumopodChatRequest({apiKey:'OFFLINE_PLACEHOLDER',modelId:r.model,mode:c.mode,maxTokens:report.requestedOutputCap,
    systemInstruction:buildSystemPrompt(c.mode,c.prompt,[],new Date(report.checkedAt),{imageInput:AI_MODELS.find(m=>m.id===r.model).supportsImageInput===true}),
    messages:[...(c.history??[]),{role:'user',content:c.prompt}],inputText:c.prompt});
  if(isDeepStrictEqual(JSON.parse(actual.init.body),r.request?.body)&&actual.url===r.request?.url)requestMatches++;
  if(r.finishReason==='stop'&&!r.error){
    completed++;
    const validation=evaluateOutput(c,r.output);
    if(isDeepStrictEqual(validation.checks,r.checks)&&validation.objectiveStatus===r.objectiveStatus)validatorMatches++;
  }
  if(usageState(r).known)known++;
  tokens+=r.usage?.total_tokens??0;
  if(r.attempted)reserved+=estimateRequestCost(r.request.body,report.pricing)?.estimatedCeilingUsd??0;
  rows.push({model:r.model,caseId:r.caseId,historicalStatus:r.status,historicalObjectiveStatus:r.objectiveStatus??null,
    httpStatus:r.httpStatus,reportedModel:r.reportedModel,finishReason:r.finishReason,durationMs:r.durationMs,
    dimensions:assessScreening(c,r),usage:r.usage,usageUnknownReason:usageState(r).reason,usageBasedCostUsd:usageCost(r,report.pricing)});
}
add('reproduced-request-bodies',requestMatches===report.results.length,requestMatches);
add('historical-validator-unchanged',validatorMatches===completed,{matches:validatorMatches,complete:completed});
add('request-counter',report.modelRequests===report.results.filter(r=>r.attempted).length,report.modelRequests);
add('completion-counter',report.completedRequests===completed,completed);
add('recorded-token-counter',tokens===report.recordedTokens,tokens);
add('reservation-counter',Math.abs(reserved-report.estimatedCostReservedUsd)<1e-9,reserved);
const summaries=screeningSummary(report,cases),costs=rows.map(r=>r.usageBasedCostUsd).filter(c=>c!==null);
const source=await calibrationSource(),appEvidence=[];
for(const directory of await fs.readdir('evaluation',{withFileTypes:true})){
  if(!directory.isDirectory())continue;
  let appBytes,app;
  try{appBytes=await fs.readFile(path.join('evaluation',directory.name,'report.json'));app=JSON.parse(appBytes);}catch{continue;}
  if(app.kind!=='application-evaluation'||app.sourceKind!=='live')continue;
  appEvidence.push({ref:`evaluation/${directory.name}/report.json`,sha256:sha(appBytes),candidateModelId:app.candidateModelId,
    repeats:app.repeats,samples:app.results?.length,pipelineSha256:app.pipelineSha256,compatibleWithCurrentPipeline:app.pipelineSha256===source.pipelineSha256,
    summary:app.summary??null,limitation:'Historical operator artifact; no new provider call or human review was performed.'});
}
const analysis={schemaVersion:1,kind:'offline-screening-analysis',sourceReport:{ref:input.replaceAll('\\','/'),sha256:sha(bytes)},
  checkedAt:new Date().toISOString(),audit,status:audit.every(a=>a.pass)?'CONSISTENT_OPERATOR_ARTIFACTS':'AUDIT_DIFFERENCES',
  observed:{rows:report.results.length,uniquePairs:unique.size,statuses:counts(report.results.map(r=>r.status)),finishReasons:counts(report.results.map(r=>r.finishReason)),
    httpStatuses:counts(report.results.map(r=>r.httpStatus)),modelMatches:report.results.filter(r=>r.reportedModel===r.model).length,
    objectivePass:report.results.filter(r=>r.objectiveStatus==='PASS').length,objectiveFail:report.results.filter(r=>r.objectiveStatus==='FAIL').length,
    usageKnown:known,usageUnknown:report.modelRequests-known,recordedTokens:tokens,reservedEstimateUsd:report.estimatedCostReservedUsd,
    knownUsageCostSubtotalUsd:costs.length?costs.reduce((a,b)=>a+b,0):null,totalUsageCostUsd:costs.length===report.modelRequests?costs.reduce((a,b)=>a+b,0):null,actualBilledUsd:null},
  models:summaries,rows,currentFingerprint:source,applicationEvidence:appEvidence,
  limitations:['Consistency verifies operator-controlled artifacts; it does not independently authenticate gateway responses or underlying model identity.',
    'New dimensions supplement the immutable historical rubric. Fenced JSON remains historical FAIL, while semantic content may pass the new separate check.',
    'Unknown historical usage reasons describe observed parser/request behavior, not evidence that trailing frames were actually sent.',
    'Small unequal sets of completed cases do not establish a universal speed or quality ranking.']};
await fs.mkdir(path.dirname(root),{recursive:true});await fs.mkdir(root);
await fs.writeFile(path.join(root,'analysis.json'),JSON.stringify(analysis,null,2),{flag:'wx'});
const md=['# Analisis offline AET AI','',`Status: **${analysis.status}**. SHA-256 laporan: \`${sha(bytes)}\`.`,
  `Diperiksa ${report.results.length} pasangan model/kasus; ${completed} lengkap, ${analysis.observed.finishReasons.length??0} terpotong. Legacy PASS/INCONCLUSIVE/FAIL: ${analysis.observed.statuses.PASS}/${analysis.observed.statuses.INCONCLUSIVE}/${analysis.observed.statuses.FAIL}.`,
  `Lulus objektif: ${analysis.observed.objectivePass}; gagal objektif lengkap: ${analysis.observed.objectiveFail}. Usage diketahui: ${known}/${report.modelRequests}. Subtotal biaya usage: USD ${analysis.observed.knownUsageCostSubtotalUsd}; biaya total dan tagihan aktual: null.`, '',dimensionMarkdown(summaries),
  '## Pemeriksaan artefak','',...audit.map(a=>`- ${a.pass?'PASS':'FAIL'}: ${a.name}.`),'',
  '## Bukti aplikasi historis','',...appEvidence.map(e=>`- ${e.ref}: ${e.candidateModelId}, ${e.samples} sampel, ${e.repeats} pengulangan; fingerprint saat ini ${e.compatibleWithCurrentPipeline?'cocok':'tidak cocok; retest diperlukan'}.`),'',...analysis.limitations.map(l=>'- '+l),''];
await fs.writeFile(path.join(root,'analysis.md'),md.join('\n'),{flag:'wx'});
console.log(JSON.stringify({status:analysis.status,observed:analysis.observed,json:path.join(root,'analysis.json'),markdown:path.join(root,'analysis.md')}));
if(analysis.status!=='CONSISTENT_OPERATOR_ARTIFACTS')process.exitCode=2;
