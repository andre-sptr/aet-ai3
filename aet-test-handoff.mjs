import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';

const root = process.cwd();
const mode = process.argv[2] || 'local';
if (!['local','prepare','smoke','full'].includes(mode)) throw new Error('Gunakan local, prepare, smoke, atau full.');
const key = process.env.SUMOPOD_API_KEY || '';
const secrets = Object.entries(process.env).filter(([name,value]) => /KEY|SECRET|TOKEN|PASSWORD/i.test(name) && value?.length >= 8).map(([,value]) => value);
function clean(value) {
  let text = String(value);
  for (const secret of secrets) text = text.replaceAll(secret, '[REDACTED]');
  return text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,'[REDACTED]').replace(/\bBearer\s+[^\s"'<>;,}]+/gi,'Bearer [REDACTED]');
}
const safeJson = value => JSON.stringify(value, (_name,item) => typeof item === 'string' ? clean(item) : item, 2);
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
const tag = new Date().toISOString().replace(/[:.]/g,'-') + '-' + randomUUID().slice(0,8);
const privateDir = path.join(root,'.aet-test-private');
const outputDir = path.join(root,'test-results',tag);
await fs.mkdir(outputDir,{recursive:true});
const bundle = {schemaVersion:1,mode,startedAt:new Date().toISOString(),node:process.version,platform:process.platform,status:'BLOCKED',sourceHashes:{},checks:[],benchmark:null,actualCostUsd:null};
let code = 2;
async function run(label,args,env) {
  console.log('Menjalankan: '+label);
  const started = Date.now();
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath,args,{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output = '', truncated = false;
    const capture = bytes => { output += bytes.toString(); if (output.length > 1_000_000) {output=output.slice(-1_000_000);truncated=true;} };
    child.stdout.on('data',capture); child.stderr.on('data',capture);
    child.on('error',error=>resolve({exitCode:null,status:'BLOCKED',log:clean(error.message)}));
    child.on('close',exitCode=>resolve({exitCode,status:exitCode===0?'PASS':'FAIL',log:clean(output),logTruncated:truncated}));
  });
  bundle.checks.push({label,durationMs:Date.now()-started,...result});
  console.log(label+': '+result.status);
  return result.exitCode === 0;
}
try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Gunakan Node.js 24 atau lebih baru.');
  const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  if (pkg.name !== 'aet-ai' || !pkg.scripts?.['test:benchmark']) throw new Error('Jalankan dari folder aetpcr yang berisi package.json versi hasil audit.');
  const sourceFiles = ['package.json','package-lock.json','lib/sumopod.ts','lib/ai-models.ts','app/api/chat/route.ts','lib/ai/context.ts','lib/ai/message-context.ts','lib/ai/model-config.ts','lib/ai/model-router.ts','lib/ai/routing-policy.ts','scripts/benchmark-core.mjs','scripts/benchmark-all-models.mjs','tests/fixtures/all-model-benchmark.json',...['core','smart-companion','academic-writer','coding-expert','prompt-builder','response-policy'].map(name=>'lib/ai/personas/'+name+'.ts')];
  for (const file of sourceFiles) if (await exists(path.join(root,file))) bundle.sourceHashes[file]=createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
  try { bundle.gitRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch { bundle.gitRevision=null; }
  if (mode === 'prepare') {
    if (!key) throw new Error('Isi environment SUMOPOD_API_KEY terlebih dahulu; lihat PANDUAN_TEST_AET.md.');
    await fs.mkdir(privateDir,{recursive:true,mode:0o700});
    for (const [name,template] of [['budget.json','benchmark-budget.example.json'],['pricing.json','benchmark-pricing.example.json']]) {
      const target=path.join(privateDir,name);
      if (await exists(target)) continue; // Never overwrite operator evidence or filled rates.
      const data=JSON.parse(await fs.readFile(path.join(root,'docs',template),'utf8'));
      if (name==='budget.json') data.keySha256=createHash('sha256').update(key).digest('hex');
      await fs.writeFile(target,safeJson(data),{flag:'wx',mode:0o600});
    }
    bundle.status='INCONCLUSIVE';bundle.note='Template dibuat tanpa mengaktifkan attestasi. Verifikasi limit di dashboard dan isi tarif resmi sebelum live. File privat tidak dimasukkan dalam hasil.';
    console.log('Isi .aet-test-private/budget.json dan pricing.json sesuai panduan. Contoh belum mengizinkan generasi.');
    code=0;
  } else if (mode==='local') {
    const npmCandidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
    let npmCli; for(const candidate of npmCandidates) if(await exists(candidate)){npmCli=candidate;break;}
    if (!npmCli) throw new Error('npm CLI tidak ditemukan. Gunakan instalasi resmi Node.js dengan npm.');
    const env={...process.env,SUMOPOD_API_KEY:'',TAVILY_API_KEY:'',BLOB_READ_WRITE_TOKEN:'',AET_LIVE_TEST_APPROVED:'false',ADMIN_PASSWORD:'',ADMIN_SESSION_SECRET:'',AET_FRONTIER_ACCESS_SECRET:''};
    const db=path.join(outputDir,'disposable.db');
    await fs.copyFile(path.join(root,'prisma/dev.db'),db);
    env.DATABASE_URL='file:'+db.replaceAll('\\','/');
    try {
      if (await run('npm ci',[npmCli,'ci','--fetch-retries=0','--fetch-timeout=30000'],env)) {
        await run('npm test',[npmCli,'test'],env);
        await run('npm run lint',[npmCli,'run','lint'],env);
        if (await exists(path.join(root,'.next'))) {
          await fs.mkdir(privateDir,{recursive:true,mode:0o700});
          await fs.rename(path.join(root,'.next'),path.join(privateDir,'previous-next-'+tag));
        }
        const built=await run('npm run build',[npmCli,'run','build'],env);
        await run('TypeScript --noEmit',[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit'],env);
        if(built) await run('npm run test:http',[npmCli,'run','test:http'],env);
        else bundle.checks.push({label:'npm run test:http',status:'BLOCKED',log:'Build belum lulus; HTTP tidak dijalankan.'});
      }
    } finally { for (const suffix of ['','-journal','-wal','-shm']) await fs.rm(db+suffix,{force:true}); }
    bundle.status=bundle.checks.length===6 && bundle.checks.every(check=>check.status==='PASS')?'PASS':'FAIL';
    code=bundle.status==='PASS'?0:2;
  } else {
    const reportDir=path.join(root,'docs','benchmarks','user-'+tag);
    const env={...process.env,SUMOPOD_BASE_URL:'https://ai.sumopod.com/v1',AET_ALLOW_LOCAL_TEST_GATEWAY:'false',AET_BENCHMARK_MAX_REQUESTS:mode==='smoke'?'12':'96',AET_BENCHMARK_MAX_TOKENS:'512',AET_BENCHMARK_OUTPUT_DIR:reportDir,AET_BENCHMARK_BUDGET_FILE:path.join(privateDir,'budget.json'),AET_BENCHMARK_PRICING_FILE:path.join(privateDir,'pricing.json')};
    await run('Benchmark '+mode,['--experimental-strip-types','--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','scripts/benchmark-all-models.mjs'],env);
    const reportFile=path.join(reportDir,'report.json');
    if(await exists(reportFile)) {
      if((await fs.stat(reportFile)).size>8_000_000) throw new Error('Laporan melebihi batas 8 MB.');
      bundle.benchmark=JSON.parse(await fs.readFile(reportFile,'utf8'));
      bundle.status=bundle.benchmark.status;
      console.log('Generasi dikirim: '+bundle.benchmark.modelRequests+'; selesai: '+bundle.benchmark.completedRequests);
    }
    code=bundle.status==='PASS'?0:2;
  }
} catch(error) { bundle.error=clean(error.message);console.log('Terhalang: '+bundle.error); }
finally {
  bundle.finishedAt=new Date().toISOString();
  const file=path.join(outputDir,'AET_TEST_RESULTS.json');
  await fs.writeFile(file,safeJson(bundle),{flag:'wx'});
  console.log('\nKirim file ini ke ChatGPT: '+file);
  console.log('Status: '+bundle.status+'. FAIL/BLOCKED/INCONCLUSIVE tetap boleh dikirim untuk dianalisis.');
}
process.exitCode=code;
