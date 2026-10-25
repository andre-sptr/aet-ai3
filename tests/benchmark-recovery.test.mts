import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { AI_MODELS } from '../lib/ai-models.ts';
import { persistCheckpoint, scheduleRemaining } from '../scripts/benchmark-recovery.mjs';

test('temporary Windows replacement lock retries without deleting the old report', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'aet-write-'));
  try {
    const target = path.join(root, 'report.json');
    await fs.writeFile(target, '{"old":true}');
    let attempts = 0;
    const io = { writeFile: fs.writeFile, rename: async (from, to) => {
      if (++attempts < 3) { assert.equal(await fs.readFile(target, 'utf8'), '{"old":true}'); throw Object.assign(new Error('locked'), { code: 'EPERM' }); }
      return fs.rename(from, to);
    } };
    const saved = await persistCheckpoint(target, '{"new":true}', { io, pause: async () => {} });
    assert.equal(saved.canonical, true);
    assert.equal(attempts, 3);
    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), {new:true});
  } finally { await fs.rm(root, {recursive:true,force:true}); }
});

test('permanent replacement lock retains complete JSON and the previous report; write failure stops', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'aet-locked-'));
  try {
    const target = path.join(root, 'report.json');
    await fs.writeFile(target, '{"old":true}');
    const io = { writeFile: fs.writeFile, rename: async () => { throw Object.assign(new Error('locked'), {code:'EPERM'}); } };
    const saved = await persistCheckpoint(target, '{"new":true}', {io,pause:async()=>{},retries:1});
    assert.equal(saved.canonical, false);
    assert.deepEqual(JSON.parse(await fs.readFile(saved.file,'utf8')), {new:true});
    assert.deepEqual(JSON.parse(await fs.readFile(target,'utf8')), {old:true});
    await assert.rejects(persistCheckpoint(target,'{}',{io:{...io,writeFile:async()=>{throw Object.assign(new Error('full'),{code:'ENOSPC'});}}}), /full/);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('remaining-wave scheduler carries historical cost and global request ceiling forward', () => {
  const report = {models:[{},{}],modelRequests:1,estimatedCostReservedUsd:0.7,results:[
    {attempted:true,model:'a',caseId:'x'},
    {attempted:false,model:'b',caseId:'x',costEstimate:{estimatedCeilingUsd:0.1}},
    {attempted:false,model:'a',caseId:'y',costEstimate:{estimatedCeilingUsd:0.2}},
    {attempted:false,model:'b',caseId:'y',costEstimate:{estimatedCeilingUsd:0.2}},
  ]};
  assert.deepEqual([...scheduleRemaining(report,4,1).scheduled], ['b:x']);
  assert.deepEqual([...scheduleRemaining(report,2,3).scheduled], ['b:x']);
  assert.equal(scheduleRemaining(report,4,0.5).scheduled.size,0);
});

type RecoveryRow = {
  model:string; attempted:boolean; status:string; httpStatus:number|null; output:string|null;
  costEstimate:{estimatedCeilingUsd:number}; request:{body:{messages:{content:string}[]}};
  reason?:string; checks?:{name:string;pass:boolean}[]; objectiveStatus?:string;
};
type RecoveryReport = {
  modelRequests:number; completedRequests:number; usageUnknownRequests:number; estimatedCostReservedUsd:number;
  finishedAt?:string; results:RecoveryRow[]; resume:{retainedAttempts:number};
};
test('LOCAL MOCK continuation retains 61 cells including FAIL, sends exactly 35, and keeps original file', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(),'aet-resume-'));
  const received:{model:string;messages:{content:string}[]}[] = [];
  const cases=JSON.parse(await fs.readFile('tests/fixtures/all-model-benchmark.json','utf8'));
  const server = createServer(async (req,res) => {
    if (req.url==='/v1/models') {res.setHeader('content-type','application/json');res.end(JSON.stringify({data:AI_MODELS.map(m=>({id:m.id}))}));return;}
    const chunks:Buffer[]=[];for await(const chunk of req) chunks.push(Buffer.from(chunk));
    const body=JSON.parse(Buffer.concat(chunks).toString());received.push(body);
    const fixture=cases.find(c=>c.prompt===body.messages.at(-1).content);
    res.setHeader('content-type','text/event-stream');
    res.end(`data: ${JSON.stringify({model:body.model,choices:[{delta:{content:fixture.reference},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('no port');
  const key='LOCAL_RESUME_FIXTURE_KEY';
  const prices=path.join(root,'pricing.json'),budget=path.join(root,'budget.json');
  await fs.writeFile(prices,JSON.stringify({operatorVerified:true,verifiedAt:new Date().toISOString(),sourceUrl:'https://sumopod.com/ai',models:Object.fromEntries(AI_MODELS.map(m=>[m.id,{inputUsdPerMillion:0.1,outputUsdPerMillion:0.5}]))}));
  const validBudget={strategy:'provider-enforced-key-cap',operatorVerified:true,dedicatedKey:true,currency:'USD',hardLimitUsd:3,verifiedAt:new Date().toISOString(),evidence:'LOCAL MOCK ONLY: no actual provider key or cap.',keySha256:createHash('sha256').update(key).digest('hex'),providerBaseUrl:'https://ai.sumopod.com/v1'};
  await fs.writeFile(budget,JSON.stringify(validBudget));
  const env={...process.env,SUMOPOD_API_KEY:key,SUMOPOD_BASE_URL:`http://127.0.0.1:${address.port}/v1`,AET_ALLOW_LOCAL_TEST_GATEWAY:'true',AET_LIVE_TEST_APPROVED:'true',AET_TEST_BUDGET_USD:'3',AET_BENCHMARK_BUDGET_FILE:budget,AET_BENCHMARK_PRICING_FILE:prices,AET_BENCHMARK_MAX_TOKENS:'512'};
  async function run(name:string,args:string[]=[],max=96) {
    const out=path.join(root,name);
    const child=spawn(process.execPath,['--experimental-strip-types','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/benchmark-all-models.mjs',...args],{env:{...env,AET_BENCHMARK_MAX_REQUESTS:String(max),AET_BENCHMARK_OUTPUT_DIR:out},stdio:['ignore','pipe','pipe']});
    let stderr='',stdout='';child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>stdout+=b);
    const code=await new Promise<number|null>((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
    let report:RecoveryReport|undefined;try{report=JSON.parse(await fs.readFile(path.join(out,'report.json'),'utf8'));}catch{}
    return {code,stderr,stdout,report:report!};
  }
  try {
    const first=await run('first',[],60);
    assert.equal(first.report.modelRequests,60,first.stderr);
    const source=structuredClone(first.report), row=source.results[60];
    Object.assign(row,{attempted:true,status:'FAIL',httpStatus:200,finishReason:'stop',reportedModel:row.model,output:'wrong-answer',checks:[{name:'exact-reference',pass:false}],objectiveStatus:'FAIL',durationMs:1,reason:undefined});
    delete row.reason;
    source.modelRequests++;source.completedRequests++;source.usageUnknownRequests++;
    source.estimatedCostReservedUsd+=row.costEstimate.estimatedCeilingUsd;
    delete source.finishedAt;
    const sourceFile=path.join(root,'recovered.json');
    const sourceText=JSON.stringify(source);await fs.writeFile(sourceFile,sourceText);
    const before=received.length;
    const plan=await run('plan',['--resume',sourceFile,'--plan']);
    assert.equal(plan.code,0,plan.stderr);assert.equal(received.length,before);
    assert.equal(plan.report.modelRequests,61);
    const resumed=await run('resumed',['--resume',sourceFile]);
    assert.equal(resumed.report.modelRequests,96,resumed.stderr);
    assert.equal(resumed.report.resume.retainedAttempts,61);
    assert.equal(received.length-before,35);
    assert.deepEqual(resumed.report.results.slice(0,61),source.results.slice(0,61));
    assert.equal(await fs.readFile(sourceFile,'utf8'),sourceText);
    assert.ok(resumed.report.estimatedCostReservedUsd>source.estimatedCostReservedUsd);
    assert.doesNotMatch(resumed.stdout+resumed.stderr+JSON.stringify(resumed.report),new RegExp(key));

    const changed=structuredClone(source);changed.results[61].request.body.messages.at(-1).content='untrusted changed prompt';
    const altered=path.join(root,'altered.json');await fs.writeFile(altered,JSON.stringify(changed));
    const calls=received.length;
    const bad=await run('bad',['--resume',altered]);
    assert.equal(bad.code,1);assert.match(bad.stderr,/Resume rejected/);assert.equal(received.length,calls);

    await fs.writeFile(budget,JSON.stringify({...validBudget,dedicatedKey:false}));
    const blocked=await run('blocked',['--resume',sourceFile]);
    assert.equal(received.length,calls);assert.equal(blocked.report.modelRequests,61);
    assert.ok(blocked.report.results.slice(61).every(r=>!r.attempted));
    await fs.writeFile(budget,JSON.stringify(validBudget));

    const circuit=structuredClone(source);circuit.results[60].httpStatus=403;
    const circuitFile=path.join(root,'circuit.json');await fs.writeFile(circuitFile,JSON.stringify(circuit));
    const stopped=await run('circuit',['--resume',circuitFile]);
    assert.equal(stopped.report.modelRequests,61);assert.equal(received.length,calls);

    const duplicate=await run('duplicate',['--resume',sourceFile]);
    assert.equal(duplicate.code,1);assert.match(duplicate.stderr,/already has a continuation/);
    assert.equal(received.length,calls);

    const uncertain=structuredClone(source), uncertainRow=uncertain.results[60];
    Object.assign(uncertainRow,{status:'BLOCKED',httpStatus:null,finishReason:null,reportedModel:null,output:null,durationMs:null,reason:'ATTEMPT_IN_FLIGHT: dispatch intent recorded; never automatically replay this cell.'});
    delete uncertainRow.checks;delete uncertainRow.objectiveStatus;
    uncertain.completedRequests--;
    const uncertainFile=path.join(root,'uncertain.json');await fs.writeFile(uncertainFile,JSON.stringify(uncertain));
    const afterCrash=await run('uncertain',['--resume',uncertainFile]);
    assert.equal(afterCrash.report.modelRequests,96,afterCrash.stderr);
    assert.equal(received.length-calls,35);
    assert.equal(afterCrash.report.results[60].status,'BLOCKED');
    assert.equal(afterCrash.report.results[60].output,null);
  } finally { server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await fs.rm(root,{recursive:true,force:true}); }
});
