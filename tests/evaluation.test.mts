import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
async function run(args:string[],extra:Record<string,string>={}){
 const directory=await mkdtemp(path.join(tmpdir(),'aet-evaluation-'));const output=path.join(directory,'run');
 const child=spawn(process.execPath,['--experimental-strip-types','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/evaluate-ai.mjs','--out',output,...args],{env:{...process.env,SUMOPOD_API_KEY:'',AET_LIVE_TEST_APPROVED:'false',AET_BENCHMARK_BUDGET_FILE:'',AET_BENCHMARK_PRICING_FILE:'',...extra},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>{log+=b;});child.stderr.on('data',b=>{log+=b;});
 const code=await new Promise<number|null>((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
 try{return {code,log,report:JSON.parse(await readFile(path.join(output,'report.json'),'utf8')),csv:await readFile(path.join(output,'review.csv'),'utf8')};}finally{await rm(directory,{recursive:true,force:true});}
}
test('evaluation defaults to zero-network plan with identical cases, four variants and three repeats',async()=>{
 const {code,report}=await run([]);assert.equal(code,0);assert.equal(report.sourceKind,'PLAN_ONLY');assert.equal(report.modelRequests,0);assert.equal(report.results.length,120);assert.ok(report.results.every((r:{status:string})=>r.status==='NOT_RUN'));assert.ok(report.summary.every((r:{objectivePassRate:unknown})=>r.objectivePassRate===null));assert.equal(report.registry.length,12);assert.ok(report.registry.every((r:{freshCapabilityProbe:string})=>r.freshCapabilityProbe==='NOT_RUN'));
});
test('mock evaluation records negative baseline control, usable new context, and blinded review without billing claims',async()=>{
 const {code,report,csv}=await run(['--mock','--repeat','1','--max-requests','100']);assert.equal(code,0);assert.equal(report.sourceKind,'LOCAL_MOCK');assert.ok(report.modelRequests>0);assert.equal(report.actualBilledCostUsd,null);const negatives=report.results.filter((r:{status:string})=>r.status==='FAIL');assert.equal(negatives.length,1);assert.equal(negatives[0].caseId,'early-constraint');assert.equal(negatives[0].variant,'baseline');assert.ok(report.results.filter((r:{variant:string})=>r.variant!=='baseline').every((r:{status:string})=>['PASS','REVIEW_REQUIRED'].includes(r.status)));assert.doesNotMatch(csv.split('\n')[0],/variant/);assert.doesNotMatch(JSON.stringify(report),/LOCAL_MOCK_NO_SECRET|Authorization|Bearer /);
});
test('unapproved live evaluation fails closed, has no fabricated scores and makes no generations',async()=>{
 const {code,report}=await run(['--live','--repeat','1']);assert.equal(code,2);assert.equal(report.status,'BLOCKED');assert.equal(report.modelRequests,0);assert.ok(report.results.every((r:{status:string})=>r.status==='BLOCKED'));assert.ok(report.summary.every((r:{objectivePassRate:unknown})=>r.objectivePassRate===null));
});
test('global evaluation request ceiling includes every role and blocks remaining samples',async()=>{
 const {report}=await run(['--mock','--repeat','1','--max-requests','1']);assert.equal(report.modelRequests,1);assert.ok(report.results.some((r:{status:string})=>r.status==='BLOCKED'));assert.equal(report.actualBilledCostUsd,null);
});

test('accelerated three-repeat mock matrix keeps production per-request budgets without hitting the real-time throughput window',async()=>{
 const {report}=await run(['--mock','--repeat','3','--max-requests','250']);assert.equal(report.results.length,120);assert.equal(report.simulationOverrides.providerCallsPerMinute,10000);assert.ok(report.results.every((r:{status:string})=>r.status!=='ERROR'&&r.status!=='BLOCKED'));assert.ok(report.modelRequests>120);assert.equal(report.results.filter((r:{status:string})=>r.status==='FAIL').length,3);
});
