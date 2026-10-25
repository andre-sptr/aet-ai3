import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {auditScreeningReport,FINAL_SCREENING_REPORT} from '../scripts/routing-evidence-core.mjs';

test('immutable final screening has 96 unique attempts and 61 unchanged ancestors, without invented reviews or usage',async()=>{
 const a=await auditScreeningReport();
 assert.equal(a.uniqueAttempts,96);assert.deepEqual(a.statuses,{PASS:64,INCONCLUSIVE:15,FAIL:17});
 assert.deepEqual(a.finishReasons,{stop:87,length:9});assert.equal(a.reportedIdentityMatches,96);
 assert.equal(a.usageUnknownRequests,96);assert.equal(a.actualCostUsd,null);assert.equal(a.productionStatus,'pending');
 assert.equal(a.lineage[0].attempted,61);assert.equal(a.lineage[1].newAttempts,35);assert.equal(a.lineage[1].legacyKeyBinding,true);
 const formats=a.failures.filter(f=>f.kind==='raw_json_format');assert.equal(formats.length,4);assert.ok(formats.every(f=>f.semanticJsonMatches===true&&f.originalStatus==='FAIL'));
 assert.equal(a.failures.filter(f=>f.kind==='truncation').length,9);assert.equal(a.failures.filter(f=>f.kind==='wrong_answer').length,4);
 assert.equal(a.models.length,12);assert.ok(a.models.every(m=>m.cases.length===8));
});
test('screening audit rejects duplicated cells and a changed resume parent hash',async()=>{
 const original=JSON.parse(await readFile(FINAL_SCREENING_REPORT,'utf8'));
 const directory=await mkdtemp('docs/benchmarks/audit-test-'),ref=path.join(directory,'report.json');
 try {
  const duplicate=structuredClone(original);duplicate.results[1]=duplicate.results[0];await writeFile(ref,JSON.stringify(duplicate));
  await assert.rejects(()=>auditScreeningReport(ref),/Duplicate/);
  const altered=structuredClone(original);altered.resume.sourceSha256='f'.repeat(64);await writeFile(ref,JSON.stringify(altered));
  await assert.rejects(()=>auditScreeningReport(ref),/Resume source hash/);
  const forged=structuredClone(original);forged.results[0].output='WRONG';await writeFile(ref,JSON.stringify(forged));
  await assert.rejects(()=>auditScreeningReport(ref),/Inherited outcome/);
 } finally {await rm(directory,{recursive:true,force:true});}
});
test('historical audit accepts the exact optional usage addition but rejects every other request change',async()=>{
 const original=JSON.parse(await readFile(FINAL_SCREENING_REPORT,'utf8'));
 const directory=await mkdtemp('docs/benchmarks/usage-audit-test-'),ref=path.join(directory,'report.json');
 try{
  const fixture=structuredClone(original);
  delete fixture.resume;
  fixture.validationFixtureNotice='SYNTHETIC DERIVED CONTRACT TEST ONLY; no new live requests or usage asserted.';
  const row=fixture.results.find(r=>r.model==='gpt-4o-mini');
  row.request.body.stream_options={include_usage:true};
  await writeFile(ref,JSON.stringify(fixture));
  assert.equal((await auditScreeningReport(ref)).uniqueAttempts,96);
  const rejected=async(change:(value:typeof fixture)=>void)=>{
   const altered=structuredClone(fixture);change(altered);await writeFile(ref,JSON.stringify(altered));
   await assert.rejects(()=>auditScreeningReport(ref),/Actual request differs/);
  };
  await rejected(value=>{value.results.find(r=>r.model==='gpt-4o-mini').request.body.stream_options={include_usage:false};});
  await rejected(value=>{value.results.find(r=>r.model==='gpt-4o-mini').request.body.max_tokens++;});
  await rejected(value=>{value.results.find(r=>r.model==='gpt-4o-mini').request.body.messages.at(-1).content='changed prompt';});
  await rejected(value=>{value.results.find(r=>r.model==='gpt-4.1-mini').request.body.stream_options={include_usage:true};});
 }finally{await rm(directory,{recursive:true,force:true});}
});
