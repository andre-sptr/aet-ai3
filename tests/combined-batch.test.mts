import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchLedger, restoreBatch } from '../scripts/batch-ledger.mjs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';

const prices={allowed:true,models:{'gpt-4o-mini':{inputUsdPerMillion:1,outputUsdPerMillion:2},'gpt-5.4-mini':{inputUsdPerMillion:2,outputUsdPerMillion:3}}};
const body=(model='gpt-4o-mini')=>({model,messages:[{role:'user',content:'fixture'}],max_tokens:64});
const base=()=>({schemaVersion:1,kind:'combined-model-evaluation',sourceKind:'LOCAL_MOCK',planOnly:false,protocolSha256:'protocol',keySha256:'fixture',maxRequests:3,
  deadlineAt:Date.now()+10000,maxReportedTokens:10000,maxReservedTokens:100000,recordedTokens:0,reservedTokens:0,modelRequests:0,reservedCostEstimateUsd:0,circuit:null,
  attempts:[],results:[{sampleId:'a',attempted:true,status:'DISPATCHING'},{sampleId:'b',attempted:false,status:'NOT_RUN'}],pricing:prices});

test('one serialized ledger charges every model and role before dispatch, retaining uncertain reservations',async()=>{
  const report=base(),snapshots:unknown[]=[];
  const ledger=new BatchLedger(report,{pricing:prices,maxRequests:2,capUsd:3,checkpoint:async()=>{snapshots.push(structuredClone(report));}});
  const [planner,worker]=await Promise.all([ledger.reserve('a',body(),'planner'),ledger.reserve('a',body('gpt-5.4-mini'),'worker')]);
  assert.equal(report.modelRequests,2);assert.equal(snapshots.length,2);assert.equal(planner.role,'planner');assert.equal(worker.role,'worker');
  assert.ok(report.reservedCostEstimateUsd>0);assert.ok(report.reservedTokens>0);
  await assert.rejects(()=>ledger.reserve('a',body(),'answer'),/Global request/);assert.equal(report.attempts.length,2);
  const expected=base();expected.deadlineAt=report.deadlineAt;expected.maxRequests=3;
  const resumed=restoreBatch(structuredClone(report),expected,prices);
  assert.equal(resumed.retainedAttempts,2);assert.equal(expected.results[0].attempted,true);assert.match(expected.circuit,/uncertain/);
  assert.deepEqual(expected.attempts,report.attempts);
});

test('cost, token and deadline ceilings fail before another dispatch and resume rejects altered accounting',async()=>{
  for(const config of [{capUsd:0},{maxReservedTokens:1},{maxReportedTokens:1,recordedTokens:1},{deadlineAt:Date.now()-1}]){
    const report=Object.assign(base(),config),ledger=new BatchLedger(report,{pricing:prices,maxRequests:10,capUsd:config.capUsd??3,checkpoint:async()=>{}});
    await assert.rejects(()=>ledger.reserve('a',body()));assert.equal(report.modelRequests,0);
  }
  const report=base(),ledger=new BatchLedger(report,{pricing:prices,maxRequests:3,capUsd:3,checkpoint:async()=>{}});
  await ledger.reserve('a',body());const target=base();target.deadlineAt=report.deadlineAt;
  assert.throws(()=>restoreBatch({...report,reservedTokens:0},target,prices),/counters/);
  assert.throws(()=>restoreBatch({...report,keySha256:'different'},target,prices),/protocol\/key/);
  assert.throws(()=>restoreBatch(report,target,{allowed:true,models:{}}),/rates changed/);
});

async function runner(directory:string,flags:string[]){
  const out=path.join(directory,'run-'+Math.random().toString(16).slice(2));
  const child=spawn(process.execPath,['--experimental-strip-types','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/evaluate-all-models.mjs','--out',out,...flags],{
    env:{...process.env,SUMOPOD_API_KEY:'',AET_LIVE_TEST_APPROVED:'false',AET_BENCHMARK_BUDGET_FILE:'',AET_BENCHMARK_PRICING_FILE:'',ENABLE_FRONTIER:'false'},stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',b=>{log+=b;});child.stderr.on('data',b=>{log+=b;});
  const code=await new Promise<number|null>((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
  assert.ok([0,2].includes(code??-1),log);
  return {code,out,report:JSON.parse(await readFile(path.join(out,'report.json'),'utf8'))};
}

test('all-model default plan dispatches nothing and combined mock retains shared limits across profiles and roles',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'aet-combined-'));
  try{
    const plan=await runner(directory,[]);assert.equal(plan.report.sourceKind,'PLAN_ONLY');assert.equal(plan.report.modelRequests,0);assert.equal(plan.report.plan.gatewayCalls,288);
    assert.equal(plan.report.plan.actualOutputCaps['gemini/gemini-3.5-flash'],1024);
    const mock=await runner(directory,['--mock','--profiles','screening,application','--models','gpt-4o-mini,gpt-5.4-mini','--repeat','1','--max-requests','4',
      '--cases','stream-smoke,comparison','--fixture','tests/fixtures/adaptive-evaluation.json','--modes','think']);
    assert.equal(mock.report.modelRequests,4);assert.equal(mock.report.attempts.length,4);
    assert.ok(mock.report.attempts.some((a:{role:string})=>a.role==='planner'));assert.ok(mock.report.results.some((r:{status:string})=>r.status==='BLOCKED'));
    assert.equal(mock.report.actualBilledCostUsd,null);assert.ok(mock.report.reservedCostEstimateUsd>0);
    for(const ref of mock.report.applicationReports){const sub=JSON.parse(await readFile(path.resolve(ref.ref),'utf8'));assert.equal(sub.kind,'application-evaluation');assert.equal(sub.globalBudget.modelRequests,4);}
    const complete=await runner(directory,['--mock','--profiles','application','--models','gpt-4o-mini','--repeat','1','--max-requests','6',
      '--cases','comparison','--fixture','tests/fixtures/adaptive-evaluation.json','--modes','think']);
    assert.equal(complete.report.modelRequests,5);
    assert.deepEqual(complete.report.attempts.map((a:{role:string})=>a.role),['planner','worker','worker','answer','verifier']);
    assert.equal(complete.report.results[0].telemetry.llmAttempts,5);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('resume retains a failed or uncertain original sample and never redispatches it',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'aet-resume-batch-'));
  const flags=['--mock','--models','gpt-4o-mini,gpt-5.4-mini','--cases','stream-smoke','--repeat','1','--max-requests','1'];
  try{
    const first=await runner(directory,flags);
    first.report.results[0].status='ERROR';first.report.results[0].errorCode='UNCERTAIN_TEST_FIXTURE';first.report.attempts[0].status='DISPATCHING';
    const uncertain=path.join(directory,'uncertain.json');await writeFile(uncertain,JSON.stringify(first.report));
    const second=await runner(directory,[...flags,'--resume',uncertain]);
    assert.equal(second.report.modelRequests,1);assert.equal(second.report.resume.retainedSamples,2);assert.equal(second.report.results[0].errorCode,'UNCERTAIN_TEST_FIXTURE');
    assert.deepEqual(second.report.attempts,first.report.attempts);assert.match(second.report.circuit,/uncertain/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
