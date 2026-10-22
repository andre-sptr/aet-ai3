import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AI_MODELS } from '../lib/ai-models.ts';
import { validateBudgetPolicy, evaluateOutput, validateLastFunction, redact, loadBudgetGuard, validatePricing, estimateRequestCost, partialComposite } from '../scripts/benchmark-core.mjs';

test('budget guard fails closed without real-cap evidence and never accepts a budget over USD 3', () => {
  const verifiedAt = new Date().toISOString();
  const policy = { strategy: 'provider-enforced-key-cap', operatorVerified: true, dedicatedKey: true, currency: 'USD', hardLimitUsd: 3, verifiedAt, evidence: 'Test fixture representing a checked provider spending cap.' };
  assert.equal(validateBudgetPolicy(undefined).allowed, false);
  assert.equal(validateBudgetPolicy(policy, 4).allowed, false);
  assert.equal(validateBudgetPolicy({ ...policy, hardLimitUsd: 4 }).allowed, false);
  assert.equal(validateBudgetPolicy({ ...policy, operatorVerified: false }).allowed, false);
  assert.equal(validateBudgetPolicy({ ...policy, dedicatedKey: false }).allowed, false);
  assert.equal(validateBudgetPolicy({ ...policy, verifiedAt: '2000-01-01' }).allowed, false);
  assert.equal(validateBudgetPolicy(policy).allowed, true);
});

test('deterministic dataset has reference answers and exactly the promised matrix', async () => {
  const cases = JSON.parse(await readFile('tests/fixtures/all-model-benchmark.json', 'utf8'));
  assert.equal(AI_MODELS.length * cases.length, 96);
  assert.equal(cases.filter(c => c.category === 'persona').length * AI_MODELS.length, 36);
  assert.equal(cases.filter(c => c.category === 'reasoning').length * AI_MODELS.length, 36);
  assert.equal(12 * 15000 * 0.8 + 10000, Number(cases.find(c => c.id === 'reasoning-quantitative').reference));
  const days = ['Senin', 'Selasa', 'Rabu']; const solutions: string[] = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
    if (new Set([a,b,c]).size === 3 && a < c && b !== 0 && c !== 2) solutions.push(`A=${days[a]}; B=${days[b]}; C=${days[c]}`);
  }
  assert.deepEqual(solutions, [cases.find(c => c.id === 'reasoning-constraints').reference]);
  for (const c of cases) {
    assert.ok(c.failureConditions.length && c.reference && c.prompt);
    if (c.validator === 'exact' || c.validator === 'uncertainty-json' || c.validator === 'safe-last-function') assert.equal(evaluateOutput(c, c.reference).objectiveStatus, 'PASS');
  }
});

test('code validator executes only its fully whitelisted program templates', () => {
  assert.equal(validateLastFunction('export function last(items) { return items.at(-1); }'), true);
  assert.equal(validateLastFunction('export function last(items) { return items[items.length - 1]; }'), true);
  for (const output of ['export function last(items) { return items[items.length]; }', 'process.exit(0)', 'export function last(items) { return items.at(-1); }; process.exit(0)', '```js\nexport function last(items) { return items.at(-1); }\n```']) assert.equal(validateLastFunction(output), false);
  assert.equal(redact('value=sk-'+'exampleOnly1234567890'), 'value=[REDACTED]');
});

async function runHarness(validBudget: boolean, mismatch = false, options: { metadataStatus?: number; absentIds?: boolean; generationStatus?: number; maxRequests?: number; rate?: number; missingPricing?: boolean; changedKey?: boolean } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'aet-benchmark-'));
  const received: { model: string; messages: {role:string; content:string}[]; [key:string]: unknown }[] = [];
  const server = createServer(async (req, res) => {
    if (req.url === '/v1/models') {
      res.statusCode = options.metadataStatus || 200;
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: options.absentIds ? [] : AI_MODELS.map(({id}) => ({id})) })); return;
    }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()); received.push(body);
    if (options.generationStatus) {
      res.statusCode = options.generationStatus;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'test_provider_denial', message: 'Denied test-key-no-secret Authorization: Bearer private-fixture-token' } }));
      return;
    }
    const prompt = body.messages.at(-1).content;
    const output = /Baterai HP/.test(prompt)
      ? '1. Aktifkan mode hemat daya dan turunkan kecerahan layar agar konsumsi energi berkurang.\n2. Hindari aplikasi berat dan hubungi keluarga seperlunya; durasi baterai tetap bergantung kondisi perangkat.'
      : /Penelitian potong lintang/.test(prompt)
      ? 'Pada 120 siswa, korelasi positif r = 0,42 menunjukkan asosiasi durasi belajar dan nilai ujian. Nilai p = 0,01 mendukung adanya hubungan statistik dengan asumsi analisis terpenuhi. Desain potong lintang belum membuktikan kausalitas atau arah sebab-akibat. Potensi perancu seperti kemampuan awal dan dukungan keluarga perlu dipertimbangkan, tetapi pengaruhnya tidak diketahui dari data yang tersedia. Karena itu, kesimpulan dibatasi pada hubungan dalam sampel ini.'
      : /off-by-one/.test(prompt) ? 'export function last(items) { return items.at(-1); }'
      : /12 buku/.test(prompt) ? '154000'
      : /masing-masing mendapat/.test(prompt) ? 'A=Senin; B=Rabu; C=Selasa'
      : /Dua catatan/.test(prompt) ? '{"status":"tidak_dapat_dipastikan","persentase":null}'
      : /anggaran saya sekarang/.test(prompt) ? '900000' : 'AET OK';
    res.setHeader('content-type', 'text/event-stream');
    res.end(`data: ${JSON.stringify({model:mismatch?'wrong-model':body.model,usage:{prompt_tokens:12,completion_tokens:3,total_tokens:15},choices:[{delta:{content:output},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  const capFile = path.join(directory, 'budget.json');
  await writeFile(capFile, JSON.stringify({ strategy: 'provider-enforced-key-cap', operatorVerified: true, dedicatedKey: true, currency: 'USD', hardLimitUsd: 3, verifiedAt: new Date().toISOString(), evidence: 'LOCAL MOCK fixture only, no paid traffic or real provider cap.', keySha256: createHash('sha256').update('test-key-no-secret').digest('hex'), providerBaseUrl: 'https://ai.sumopod.com/v1' }));
  const priceFile = path.join(directory, 'prices.json');
  await writeFile(priceFile, JSON.stringify({ operatorVerified: true, verifiedAt: new Date().toISOString(), sourceUrl: 'https://sumopod.com/ai', models: Object.fromEntries(AI_MODELS.map(m => [m.id, {inputUsdPerMillion:options.rate ?? 0.1,outputUsdPerMillion:options.rate ?? 0.5}])) }));
  const out = path.join(directory, 'run');
  try {
    const child = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/benchmark-all-models.mjs'], {
      env: { ...process.env, SUMOPOD_API_KEY: options.changedKey ? 'different-fixture-key' : 'test-key-no-secret', SUMOPOD_BASE_URL: `http://127.0.0.1:${address.port}/v1`, AET_ALLOW_LOCAL_TEST_GATEWAY: 'true', AET_LIVE_TEST_APPROVED: 'true', AET_TEST_BUDGET_USD: '3', AET_BENCHMARK_BUDGET_FILE: validBudget ? capFile : '', AET_BENCHMARK_PRICING_FILE: options.missingPricing ? '' : priceFile, AET_BENCHMARK_OUTPUT_DIR: out, AET_BENCHMARK_MAX_REQUESTS: String(options.maxRequests || 96), NO_PROXY: '127.0.0.1,localhost' },
      stdio: ['ignore','pipe','pipe'],
    });
    let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; }); child.stdout.resume();
    const code = await new Promise<number | null>((resolve,reject) => { child.on('exit',resolve);child.on('error',reject); });
    assert.equal(code, 2, stderr); // Quality review still required, or intentionally blocked/failed.
    const report = JSON.parse(await readFile(path.join(out, 'report.json'), 'utf8'));
    return { report, received };
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); }
}

test('missing budget evidence sends no generations, preserves all 96 BLOCKED cells and no invented scores', async () => {
  const { report, received } = await runHarness(false);
  assert.equal(received.length, 0); assert.equal(report.modelRequests, 0);
  assert.equal(report.results.length, 96); assert.equal(report.status, 'BLOCKED');
  assert.ok(report.results.every(row => row.status === 'BLOCKED' && Object.values(row.scores).every(score => score === null)));
});

test('LOCAL MOCK matrix uses all exact IDs, actual production personas, family parameters and immutable per-case requests', async () => {
  const { report, received } = await runHarness(true);
  assert.equal(report.modelRequests, 96); assert.equal(received.length, 96);
  assert.equal(report.recordedTokens, 96 * 15, 'mock metadata only');
  assert.equal(report.results.filter(row => row.objectiveStatus === 'FAIL').length, 0);
  assert.equal(report.results.filter(row => row.status === 'INCONCLUSIVE').length, 24, 'Daily/Report qualitative review is not faked');
  assert.deepEqual([...new Set(received.map(r => r.model))], AI_MODELS.map(m => m.id));
  for (const row of received) {
    assert.match(row.messages[0].content, /AET AI/);
    assert.match(row.messages[0].content, /SMART COMPANION|ACADEMIC WRITER|CODING EXPERT/);
    assert.equal(row.stream, true); assert.equal('reasoning_effort' in row, false);
    assert.equal('temperature' in row, false); assert.equal('tools' in row, false);
    assert.equal(row.model.startsWith('gpt-5') ? row.max_completion_tokens : row.max_tokens, row.model.startsWith('gemini/') ? 1024 : 512);
  }
  assert.doesNotMatch(JSON.stringify(report), /test-key-no-secret|Bearer |"Authorization":/);
});

test('LOCAL MOCK foreign model identity fails integration, never silently replaces requested IDs', async () => {
  const { report } = await runHarness(true, true);
  assert.equal(report.status, 'FAIL');
  assert.ok(report.results.every(row => row.status === 'FAIL' && row.output === '' && row.scores.streaming_integration === 0));
});

test('LOCAL MOCK metadata 403 and absent IDs do not prevent authorized direct generations', async () => {
  for (const options of [{metadataStatus:403}, {absentIds:true}]) {
    const { report, received } = await runHarness(true, false, options);
    assert.equal(received.length, 96);
    assert.equal(report.results.filter(row => row.attempted).length, 96);
  }
});

test('LOCAL MOCK starts with a balanced smoke wave over all 12 models before other cases', async () => {
  const { report, received } = await runHarness(true, false, {maxRequests:12});
  assert.equal(received.length, 12);
  assert.deepEqual(received.map(r => r.model), AI_MODELS.map(m => m.id));
  assert.ok(report.results.filter(r => r.attempted).every(r => r.caseId === 'stream-smoke'));
});

test('LOCAL MOCK direct generation permission error opens circuit with safe provider evidence', async () => {
  const { report, received } = await runHarness(true, false, {metadataStatus:403, generationStatus:403});
  assert.equal(received.length, 1);
  assert.equal(report.results.filter(r => r.status === 'FAIL').length, 1);
  const failed = report.results.find(r => r.status === 'FAIL');
  assert.equal(failed.providerError.kind, 'permission');
  assert.equal(failed.providerError.providerCode, 'test_provider_denial');
  assert.doesNotMatch(JSON.stringify(report), /test-key-no-secret|private-fixture-token/);
});

test('LOCAL MOCK wrong key binding, absent prices and unaffordable full wave send no generations',async()=>{
  for(const options of [{changedKey:true},{missingPricing:true},{rate:1000},{maxRequests:11}]){
    const {report,received}=await runHarness(true,false,options);
    assert.equal(received.length,0);assert.equal(report.status,'BLOCKED');assert.equal(report.actualCostUsd,null);
    assert.equal(report.sourceKind,'LOCAL_MOCK');
  }
});

test('price validation, actual Gemini output cap, and partial scoring keep unknown data explicit',async()=>{
  const verifiedAt=new Date().toISOString();
  const pricing={operatorVerified:true,verifiedAt,sourceUrl:'https://sumopod.com/ai',models:{'gemini/gemini-3.5-flash':{inputUsdPerMillion:1,outputUsdPerMillion:2}}};
  assert.equal(validatePricing(pricing,['missing-id']).allowed,false);
  assert.equal(validatePricing({...pricing,sourceUrl:'https://unverified.example'},[]).allowed,false);
  assert.equal(validatePricing(pricing,['gemini/gemini-3.5-flash']).allowed,true);
  const estimate=estimateRequestCost({model:'gemini/gemini-3.5-flash',messages:[{content:'hello'}],max_tokens:1024},pricing);
  assert.equal(estimate?.outputTokenLimit,1024);assert.ok(estimate!.estimatedCeilingUsd>0.002);
  assert.equal(partialComposite({accuracy:5}).weightCoverage,0.25);
  assert.equal(partialComposite({}).score0to5,null);
  assert.equal((await loadBudgetGuard({AET_TEST_BUDGET_USD:'3'})).allowed,false);
});
