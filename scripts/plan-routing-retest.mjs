/** Produces files only. This script has no network calls and never executes tests. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FINAL_SCREENING_REPORT} from './routing-evidence-core.mjs';
import {estimateRequestCost} from './benchmark-core.mjs';
import {getGenerationConfig} from '../lib/ai/model-config.ts';
const report=JSON.parse(await fs.readFile(FINAL_SCREENING_REPORT,'utf8'));
const screening=JSON.parse(await fs.readFile('tests/fixtures/all-model-benchmark.json','utf8'));
const application=JSON.parse(await fs.readFile('tests/fixtures/adaptive-evaluation.json','utf8'));
const fixture=[...screening.filter(c=>c.category==='reasoning').map(c=>({id:c.id,category:'reasoning',persona:c.mode,prompt:c.prompt,
 validator:c.validator==='uncertainty-json'?'json':c.validator,reference:c.reference})),
 ...application.filter(c=>['latest-correction','early-constraint','followup-second'].includes(c.id))];
const tasks=[];
for(const row of report.results.filter(r=>r.finishReason==='length'))for(const cap of [1024,2048])for(let repeat=1;repeat<=3;repeat++) {
 const body={...row.request.body};delete body.max_tokens;delete body.max_completion_tokens;
 Object.assign(body,getGenerationConfig(row.model,row.mode,'',cap));
 tasks.push({phase:'truncation',modelId:row.model,caseId:row.caseId,repeat,actualOutputCap:body.max_tokens??body.max_completion_tokens,
  estimate:estimateRequestCost(body,report.pricing)});
}
for(const row of report.results.filter(r=>r.status==='FAIL'&&r.finishReason==='stop'))for(let repeat=1;repeat<=3;repeat++)tasks.push({
 phase:'failed-objective',modelId:row.model,caseId:row.caseId,repeat,actualOutputCap:row.request.body.max_tokens??row.request.body.max_completion_tokens,
 estimate:estimateRequestCost(row.request.body,report.pricing)});
const appModels=['gpt-4o-mini','gpt-5.4-mini','deepseek-v4-flash'];
const appEstimates=appModels.map(modelId=>{
 const rate=report.pricing.models[modelId];
 return {modelId,chatSamples:fixture.length*3,maxGenerations:fixture.length*3,mode:'fast',reservedInputPerAttempt:24000,reservedOutputPerAttempt:4096,
  conservativeEstimateUsd:fixture.length*3*(24000*rate.inputUsdPerMillion+4096*rate.outputUsdPerMillion)/1e6};
});
const directUsd=tasks.reduce((n,r)=>n+r.estimate.estimatedCeilingUsd,0),appUsd=appEstimates.reduce((n,r)=>n+r.conservativeEstimateUsd,0);
const plan={schemaVersion:1,status:'PLAN_ONLY_NOT_AUTHORIZED',pricingSourceReport:FINAL_SCREENING_REPORT,pricingVerifiedAt:report.pricing.verifiedAt,
 pricingBasis:'Recorded operator-attested gateway non-cache/peak rates; renew and verify before any execution. Not a current price quote.',
 authorization:'Historical approval is not approval for this plan. Live execution requires new explicit cost authorization and fresh key-bound provider guard.',
 diagnosticGenerationCount:tasks.length,applicationGenerationCeiling:appEstimates.reduce((n,r)=>n+r.maxGenerations,0),
 directEstimatedUsd:directUsd,applicationConservativeEstimatedUsd:appUsd,totalPlanningEstimateUsd:directUsd+appUsd,
 suggestedProviderCapUsd:3,localReserveFraction:.2,fitsHistoricalLocalCeiling:directUsd+appUsd<=2.4,
 caveats:['No actual token usage or bill was measured.','Diagnostics change only the cap within each comparison group; retain failures and all previous originals.',
  'Three repetitions are an initial calibration minimum, not a stable p95 or general quality guarantee.',
  'Application phase uses one Fast answer per sample; retries consume the same ceiling and can block later samples.',
  'Review humans must assess all quality/instruction rows. Missing gateway usage still blocks cost-qualified promotion.',
  'Public candidates were shortlisted only from the three available reasoning cells and their observed latency/recorded rates. No production winner is asserted.',
  'Vision, tools, document reasoning, long context and non-answer roles require separate scoped suites; do not infer them here.'],
 diagnosticTasks:tasks,applicationEstimates:appEstimates,
 applicationFixture:'tests/fixtures/routing-retest.json',primaryCaseIds:fixture.filter(c=>c.category==='reasoning').map(c=>c.id),
 contextCaseIds:fixture.filter(c=>c.category==='context').map(c=>c.id)};
const datasetBytes=await fs.readFile('tests/fixtures/adaptive-evaluation.json','utf8');
const pending={schemaVersion:2,status:'pending',version:'screening-20261025-pending',
 dataset:{ref:'tests/fixtures/adaptive-evaluation.json',sha256:createHash('sha256').update(datasetBytes).digest('hex')},
 maxLatencyMs:5000,maxCostUsdPerRequest:.01,evidence:[],note:'No calibrated production candidates. Threshold ceilings are example operator limits, not measured results.'};
for(const [file,value] of [['tests/fixtures/routing-retest.json',fixture],['docs/routing-retest-plan.json',plan],['docs/routing-policy.pending.json',pending]]) {
 const bytes=JSON.stringify(value,null,2)+'\n';
 if(process.argv.includes('--check')) {if(await fs.readFile(file,'utf8')!==bytes)throw new Error(`Plan differs: ${file}`);}
 else await fs.writeFile(file,bytes,{flag:'wx'});
}
console.log(JSON.stringify({status:plan.status,directGenerations:tasks.length,applicationCeiling:plan.applicationGenerationCeiling,estimatedUsd:plan.totalPlanningEstimateUsd}));
