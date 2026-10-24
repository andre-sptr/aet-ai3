import { validatePricing } from '../lib/ai/pricing.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { redactGatewayText } from '../lib/ai/gateway-errors.ts';

export const DIMENSIONS = ['accuracy', 'reasoning_constraints', 'context_consistency', 'persona_instruction', 'instruction_following', 'persona_consistency', 'completeness_relevance', 'epistemic_integrity', 'efficiency', 'streaming_integration'];
export const DIMENSION_WEIGHTS = { accuracy:0.25, reasoning_constraints:0.20, context_consistency:0.15, persona_instruction:0.15, epistemic_integrity:0.10, streaming_integration:0.05, efficiency:0.10 };
export const emptyScores = () => Object.fromEntries(DIMENSIONS.map(name => [name, null]));
export function partialComposite(scores) {
  let weight = 0, total = 0;
  const measuredDimensions = [];
  for (const [name,w] of Object.entries(DIMENSION_WEIGHTS)) if (typeof scores[name] === 'number' && Number.isFinite(scores[name]) && scores[name] >= 0 && scores[name] <= 5) {
    total += scores[name]*w; weight += w; measuredDimensions.push(name);
  }
  return { score0to5:weight ? total/weight : null, weightCoverage:weight, measuredDimensions, comparableOnlyWithIdenticalCoverage:true };
}
export function redact(value, secret = '') {
  return redactGatewayText(value, secret);
}

/** An environment budget number alone never authorizes paid traffic. */
export function validateBudgetPolicy(policy, requestedUsd = 3, now = Date.now()) {
  if (!Number.isFinite(requestedUsd) || requestedUsd <= 0 || requestedUsd > 3) return { allowed: false, reason: 'Absolute task budget must be > 0 and <= USD 3.' };
  const checked = Date.parse(policy?.verifiedAt);
  if (policy?.strategy !== 'provider-enforced-key-cap' || policy?.operatorVerified !== true || policy?.dedicatedKey !== true || policy?.currency !== 'USD'
    || !Number.isFinite(policy?.hardLimitUsd) || policy.hardLimitUsd <= 0 || policy.hardLimitUsd > requestedUsd
    || !Number.isFinite(checked) || checked > now || now - checked > 86_400_000
    || typeof policy?.evidence !== 'string' || policy.evidence.trim().length < 20) {
    return { allowed: false, reason: 'No recent operator-verified, provider-enforced dedicated-key spending cap within the task budget. Rates and actual USD costs remain unknown; paid requests are blocked.' };
  }
  return { allowed: true, strategy: policy.strategy, hardLimitUsd: policy.hardLimitUsd, verifiedAt: policy.verifiedAt,
    verification: 'Operator attestation of provider-side enforcement; not checked automatically by this harness.', evidence: policy.evidence };
}
export async function loadBudgetGuard(env = process.env) {
  let policy;
  if (env.AET_BENCHMARK_BUDGET_FILE) {
    try { policy = JSON.parse(await fs.readFile(env.AET_BENCHMARK_BUDGET_FILE, 'utf8')); }
    catch { return { allowed: false, reason: 'Budget policy could not be read; no paid traffic sent.' }; }
  }
  const guard = validateBudgetPolicy(policy, Number(env.AET_TEST_BUDGET_USD ?? 3));
  if (!guard.allowed) return guard;
  const fingerprint = createHash('sha256').update(env.SUMOPOD_API_KEY || '').digest('hex');
  if (!env.SUMOPOD_API_KEY || policy.keySha256 !== fingerprint || policy.providerBaseUrl !== 'https://ai.sumopod.com/v1') {
    return { allowed: false, reason: 'Provider cap evidence is not bound to this exact key and verified gateway. No paid traffic sent.' };
  }
  return { ...guard, keyBound: true };
}

export { validatePricing } from '../lib/ai/pricing.ts';

export async function loadPricing(env = process.env, modelIds = []) {
  try { return validatePricing(JSON.parse(await fs.readFile(env.AET_BENCHMARK_PRICING_FILE || '', 'utf8')), modelIds); }
  catch { return { allowed: false, reason: 'Verified pricing file is missing or unreadable; no paid generation sent.' }; }
}

// Conservative planning estimate, NOT a guaranteed tokenizer bound or billing proof.
// Provider-side enforcement remains the absolute USD backstop.
export function estimateRequestCost(body, pricing) {
  const rate = pricing?.models?.[body.model];
  if (!rate) return null;
  const inputTokenEstimate = Buffer.byteLength(JSON.stringify(body.messages), 'utf8') + body.messages.length * 64 + 1024;
  const outputTokenLimit = body.max_completion_tokens ?? body.max_tokens;
  const estimatedCeilingUsd = (inputTokenEstimate * rate.inputUsdPerMillion + outputTokenLimit * rate.outputUsdPerMillion) / 1_000_000;
  if (!Number.isFinite(estimatedCeilingUsd) || estimatedCeilingUsd < 0) return null;
  return { inputTokenEstimate, outputTokenLimit, estimatedCeilingUsd };
}

export function balancedSchedule(models, cases) {
  const ordered = [...cases].sort((a, b) => Number(b.id === 'stream-smoke') - Number(a.id === 'stream-smoke'));
  return ordered.flatMap(c => models.map(model => ({ model, c })));
}
export async function assertPaidBudget(modelIds = ['gpt-4o-mini']) {
  const guard = await loadBudgetGuard();
  if (!guard.allowed) throw new Error(guard.reason);
  if (process.env.AET_LIVE_TEST_APPROVED !== 'true') throw new Error('Explicit live-test approval is required.');
  const pricing = await loadPricing(process.env, modelIds);
  if (!pricing.allowed) throw new Error(pricing.reason);
  return guard;
}
export async function freshReportPath(prefix, explicitPath = process.env.AET_TEST_REPORT) {
  const output = explicitPath || `docs/${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0,8)}.json`;
  await fs.mkdir(path.dirname(output), { recursive: true });
  const file = await fs.open(output, 'wx'); // Existing reports are never overwritten.
  await file.close();
  return output;
}

// The entire program is matched against two narrow safe grammars BEFORE execution.
// No arbitrary model-generated JavaScript is evaluated.
export function validateLastFunction(output) {
  const code = output.trim();
  const allowed = /^export\s+function\s+last\s*\(\s*items\s*\)\s*\{\s*return\s+(?:items\.at\(\s*-1\s*\)|items\[\s*items\.length\s*-\s*1\s*\])\s*;?\s*\}$/;
  if (!allowed.test(code)) return false;
  const last = new Function(`"use strict"; ${code.replace(/^export\s+/, '')}; return last;`)();
  return [[[], undefined], [[1], 1], [[1, 2, 3], 3], [[0], 0], [[false], false], [[null], null], [['a', 'b'], 'b']].every(([input, expected]) => Object.is(last(input), expected));
}
function countWords(text) { return text.trim().split(/\s+/).filter(Boolean).length; }
export function evaluateOutput(c, output) {
  const scores = emptyScores();
  const text = output.trim();
  const checks = [];
  const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  if (c.validator === 'exact') {
    add('exact-reference', text === c.reference);
    scores.accuracy = text === c.reference ? 5 : 0;
    scores.instruction_following = scores.accuracy;
  } else if (c.validator === 'uncertainty-json') {
    let data;
    try { data = JSON.parse(text); } catch { /* failed check */ }
    const correct = data?.status === 'tidak_dapat_dipastikan' && data?.persentase === null;
    add('uncertainty-and-valid-json', correct && Object.keys(data).sort().join(',') === 'persentase,status');
    scores.accuracy = correct ? 5 : 0;
    scores.epistemic_integrity = correct ? 5 : 0;
    scores.instruction_following = checks[0].pass ? 5 : 0;
  } else if (c.validator === 'safe-last-function') {
    add('whitelisted-program-passes-seven-array-cases', validateLastFunction(text));
    scores.accuracy = checks[0].pass ? 5 : 0;
    scores.instruction_following = checks[0].pass ? 5 : 0;
  } else if (c.validator === 'daily-format') {
    add('exactly-two-list-items', text.split('\n').filter(l => /^\s*(?:[-*]|\d+[.)])\s+/.test(l)).length === 2);
    add('20-to-45-words', countWords(text) >= 20 && countWords(text) <= 45);
    add('no-generic-greeting', !/^(?:halo|hai|tentu|baik|selamat)\b/i.test(text));
    scores.instruction_following = checks.every(x => x.pass) ? 5 : 0;
  } else if (c.validator === 'report-constraints') {
    add('one-paragraph', !/\n\s*\n/.test(text));
    add('60-to-90-words', countWords(text) >= 60 && countWords(text) <= 90);
    add('mentions-correlation-and-confounding', /korelasi|asosiasi/i.test(text) && /perancu|confound/i.test(text));
    add('no-generated-doi-or-url', !/10\.\d{4,9}\/|https?:\/\//i.test(text));
    scores.instruction_following = checks.slice(0, 2).every(x => x.pass) ? 5 : 0;
    // Keywords cannot establish argument quality, causal restraint, or source integrity.
  } else throw new Error(`Unknown validator: ${c.validator}`);
  if (c.category === 'reasoning' && scores.accuracy !== null) scores.reasoning_constraints = scores.accuracy;
  if (c.category === 'context' && scores.accuracy !== null) scores.context_consistency = scores.accuracy;
  return { checks, objectiveStatus: checks.every(x => x.pass) ? 'PASS' : 'FAIL', scores,
    qualitativeReview: ['daily-format', 'report-constraints'].includes(c.validator) ? 'REQUIRED' : 'Not a broad persona-quality judgment; unobserved dimensions remain null.' };
}

export function benchmarkMarkdown(report) {
  const lines = ['# Evaluasi 12 model AET AI', '', `Waktu: ${report.checkedAt}. Status keseluruhan: **${report.status}**.`, '',
    `Rencana ${report.results.length} sel: 36 persona, 36 reasoning, 12 konteks dan 12 smoke streaming. Sel tidak dijalankan tetap dicatat BLOCKED; bukan sampel model.`, '',
    '| Model | Daily | Report | Coding | Reasoning (3) | Konteks | Stream |', '| --- | --- | --- | --- | --- | --- | --- |'];
  const state = rows => rows.length ? rows.every(r => r.status === 'PASS') ? 'PASS' : [...new Set(rows.map(r => r.status))].join('/') : 'BLOCKED';
  for (const model of report.models) {
    const rows = report.results.filter(r => r.model === model.id);
    lines.push(`| ${model.id} | ${['daily', 'report', 'coding'].map(mode => state(rows.filter(r => r.category === 'persona' && r.mode === mode))).join(' | ')} | ${['reasoning', 'context', 'streaming'].map(category => state(rows.filter(r => r.category === category))).join(' | ')} |`);
  }
  lines.push('', `Jenis bukti: **${report.sourceKind || 'historical/unspecified'}**. Request generasi: ${report.modelRequests}; selesai secara teknis: ${report.completedRequests ?? 'tidak dicatat'}; request metadata: ${report.metadataRequests}; token yang benar-benar dilaporkan: ${report.recordedTokens}; biaya USD aktual: **tidak diketahui**.`, '',
    `Metadata bersifat advisory: HTTP ${report.preflight?.httpStatus ?? 'tidak tersedia'}. Metadata gagal atau ID tidak tercantum tidak menggagalkan direct POST yang sudah memenuhi semua guard.`, '',
    `Guard cap provider: ${report.budgetGuard?.allowed ? 'tercatat (attestasi operator)' : 'BLOCKED'}. ${report.budgetGuard?.reason || ''}`, '',
    `Tarif resmi terverifikasi: ${report.pricing?.allowed ? 'tercatat (attestasi operator)' : 'BLOCKED'}. ${report.pricing?.reason || ''}`, '',
    `Batas lokal estimasi: ${report.localEstimatedBudgetUsd ?? 'N/A'} USD; cadangan provider 20%; request terjadwal dalam gelombang lengkap: ${report.scheduledRequests ?? 'N/A'}. Estimasi bukan tagihan aktual atau jaminan tokenizer.`, '',
    '## Hasil per kasus', '', '| Model | Kasus | Status | HTTP | Finish | Latency ms | Usage | Alasan |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of report.results) lines.push(`| ${r.model} | ${r.caseId} | ${r.status} | ${r.httpStatus ?? '—'} | ${r.finishReason ?? '—'} | ${r.durationMs ?? '—'} | ${r.usage?.total_tokens ?? '—'} | ${(r.reason || r.error || '').replaceAll('|', '/').replaceAll('\n', ' ').slice(0, 240)} |`);
  lines.push('', '## Rubrik 0–5 dan cakupan skor', '',
    'Bobot: akurasi 25%, penalaran/kendala 20%, konsistensi konteks 15%, persona/instruksi 15%, integritas fakta 10%, streaming/integrasi 5%, latensi/biaya 10%. Skor parsial mencatat cakupan bobot; dimensi tidak teramati tetap null. Skor dengan cakupan berbeda tidak dibandingkan sebagai peringkat. Kepatuhan format dicatat terpisah dan tidak menggantikan review persona.', '',
    '0 = salah/tidak memenuhi; 1 = sebagian besar salah; 2 = kekurangan besar; 3 = memadai dengan kekurangan berarti; 4 = kuat dengan kekurangan kecil; 5 = seluruh kriteria yang dinilai terpenuhi. Validator deterministik memberikan 0/5 hanya untuk hasil/format yang dapat dibuktikan. Dimensi kualitatif tidak ditebak dari kata kunci dan tetap null sampai review tercatat.', '',
    'Semua skor per kasus dan dimensi disimpan di report.json. Skor null berarti tidak dinilai, bukan nol. Jawaban akhir dan penjelasan singkat dinilai tanpa meminta/menyimpan hidden chain-of-thought. Tidak ada model judge berbayar.', '',
    '## Rekomendasi dan keterbatasan', '',
    'Belum ada rekomendasi pemenang antar-model tanpa respons baru dan review kualitatif. Default aplikasi tetap gpt-4o-mini sesuai konfigurasi awal, bukan hasil kemenangan benchmark ini. Satu kasus per persona dan per jenis tugas hanya screening; hasil PASS objektif tidak membuktikan keunggulan umum persona.', '',
    'Prompt dibuat melalui buildSystemPrompt produksi; parameter melalui buildSumopodChatRequest; katalog dibaca dari AI_MODELS. Frontier tidak diaktifkan pada endpoint aplikasi; harness operator menguji gateway langsung hanya setelah guard biaya terpenuhi. Tidak ada native tools, parameter reasoning, vision baru, retry otomatis, fallback, atau biaya yang diperkirakan tanpa tarif terverifikasi.', '',
    'Budget guard berhenti sebelum generasi tanpa bukti cap provider pada key khusus. AET_TEST_BUDGET_USD saja tidak mengukur atau menghentikan tagihan. Attestasi operator terhadap cap provider dicatat terpisah dari verifikasi API otomatis.');
  return lines.join('\n') + '\n';
}
