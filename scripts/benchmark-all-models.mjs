import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { AI_MODELS } from '../lib/ai-models.ts';
import { buildSystemPrompt } from '../lib/ai/personas/prompt-builder.ts';
import { buildSumopodChatRequest, DEFAULT_SUMOPOD_BASE_URL, parseOpenAITextStream, StreamFailure } from '../lib/sumopod.ts';
import { boundedResponseText, readGatewayError } from '../lib/ai/gateway-errors.ts';
import { balancedSchedule, benchmarkMarkdown, DIMENSION_WEIGHTS, emptyScores, estimateRequestCost, evaluateOutput, loadBudgetGuard, loadPricing, partialComposite, redact } from './benchmark-core.mjs';

import { persistCheckpoint, restoreResults, inheritedCircuit, scheduleRemaining } from './benchmark-recovery.mjs';

const key = process.env.SUMOPOD_API_KEY || '';
const resumeIndex = process.argv.indexOf('--resume');
if (resumeIndex >= 0 && (!process.argv[resumeIndex + 1] || process.argv[resumeIndex + 1].startsWith('--'))) throw new Error('--resume requires the path to a recovered report.json.');
const resumeFile = resumeIndex >= 0 ? path.resolve(process.argv[resumeIndex + 1]) : null;
const resumedBytes = resumeFile ? await fs.readFile(resumeFile, 'utf8') : null;
const previous = resumedBytes ? JSON.parse(resumedBytes.replace(/^\uFEFF/, '')) : null;
if (previous && !Number.isFinite(Date.parse(previous.checkedAt))) throw new Error('Resume rejected: invalid original checkedAt.');
const startedAt = new Date().toISOString();
const keyHash = createHash('sha256').update(key).digest('hex');
const planOnly = process.argv.includes('--plan');
const maxRequests = Number(process.env.AET_BENCHMARK_MAX_REQUESTS ?? 96);
const maxTokens = Number(process.env.AET_BENCHMARK_MAX_TOKENS ?? 512);
if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 96 || !Number.isInteger(maxTokens) || maxTokens < 64 || maxTokens > 1024) throw new Error('Invalid explicit request/output limit.');
const cases = JSON.parse(await fs.readFile(new URL('../tests/fixtures/all-model-benchmark.json', import.meta.url), 'utf8'));
const checkedAt = previous?.checkedAt || startedAt;
const baseUrl = process.env.SUMOPOD_BASE_URL || DEFAULT_SUMOPOD_BASE_URL;
const validated = buildSumopodChatRequest({ apiKey: 'unused', baseUrl, systemInstruction: '', messages: [{ role: 'user', content: '' }] });
const gateway = new URL(validated.url);
const localMock = process.env.AET_ALLOW_LOCAL_TEST_GATEWAY === 'true' && gateway.protocol === 'http:' && ['127.0.0.1','localhost'].includes(gateway.hostname);
if (!localMock && validated.url !== `${DEFAULT_SUMOPOD_BASE_URL}/chat/completions`) throw new Error('Benchmark credentials may only be sent to the verified Sumopod endpoint or explicitly enabled loopback fixtures.');
const modelsUrl = validated.url.replace(/\/chat\/completions$/, '/models');
const root = path.resolve(process.env.AET_BENCHMARK_OUTPUT_DIR || `docs/benchmarks/run-${startedAt.replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
await fs.mkdir(path.dirname(root), { recursive: true });
await fs.mkdir(root); // Never reuse/overwrite an older run.
const guard = await loadBudgetGuard();
const pricing = await loadPricing(process.env, AI_MODELS.map(m => m.id));
let sourceRevision = null;
try { sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); } catch { /* ZIP deployments need not contain Git. */ }
const report = {
  schemaVersion: 2, benchmarkKeySha256: keyHash, sourceKind: localMock ? 'LOCAL_MOCK' : 'live', checkedAt, sourceRevision, status: 'INCONCLUSIVE', planOnly,
  models: AI_MODELS.map(({ id, name, accessPolicy }) => ({ id, name, accessPolicy })),
  datasetSha256: createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
  productionPromptSha256: createHash('sha256').update(['daily', 'report', 'coding'].map(mode => buildSystemPrompt(mode, '', [], new Date(checkedAt))).join('\n')).digest('hex'),
  budgetGuard: guard, pricing, approved: process.env.AET_LIVE_TEST_APPROVED === 'true', keyConfigured: Boolean(key),
  rubric: { scale:'0-5; null means unobserved/not applicable', weights:DIMENSION_WEIGHTS, qualitativeReview:'Required for persona judgments; no automatic judge or invented qualitative scores', operational:'HTTP, identity, finish, latency and reported usage; actual USD billing must be separately verified' },
  concurrency: 1, automaticRetries: 0, maxRequests, requestedOutputCap: maxTokens, maxReportedTokens: 180000,
  budgetReserveFraction: 0.2, localEstimatedBudgetUsd: guard.allowed ? guard.hardLimitUsd * 0.8 : null,
  estimatedCostReservedUsd: 0, plannedRequests: AI_MODELS.length * cases.length, scheduledRequests: 0,
  modelRequests: 0, completedRequests: 0, metadataRequests: 0, recordedTokens: 0, usageUnknownRequests: 0, actualCostUsd: null,
  executionOrder: 'stream-smoke for all exact IDs, then scenario-major round-robin; complete budgeted waves only',
  preflight: null, results: [],
};
for (const { model, c } of balancedSchedule(AI_MODELS, cases)) {
  const system = buildSystemPrompt(c.mode, c.prompt, [], new Date(checkedAt), { imageInput: model.supportsImageInput === true });
  const outbound = buildSumopodChatRequest({ apiKey: key || 'not-configured', baseUrl, modelId: model.id, mode: c.mode, systemInstruction: system,
    messages: [...(c.history || []), { role: 'user', content: c.prompt }], inputText: c.prompt, maxTokens, stream: true });
  const body = JSON.parse(outbound.init.body);
  report.results.push({ model: model.id, caseId: c.id, category: c.category, mode: c.mode, status: 'BLOCKED', attempted: false,
    request: { url: outbound.url, body }, costEstimate: estimateRequestCost(body, pricing), reference: c.reference, failureConditions: c.failureConditions,
    metadataListed: null, reportedModel: null, httpStatus: null, finishReason: null, durationMs: null, usage: null, output: null, scores: emptyScores(), reason: 'Not attempted yet.' });
}
if (previous) {
  const restored = restoreResults(previous, report, keyHash);
  report.resume = {
    sourceFile: path.relative(process.cwd(), resumeFile),
    sourceSha256: createHash('sha256').update(resumedBytes).digest('hex'),
    startedAt, retainedAttempts: restored.attempted, pendingAtStart: restored.pending,
    sourceRevision: previous.sourceRevision ?? null,
    legacyKeyBinding: !previous.benchmarkKeySha256,
    note: 'Original request bodies, prompt clock, outcomes, reservations and counters retained; no attempted cell is automatically repeated. Legacy v2 sources do not prove historical key identity; keep the same dedicated key and provider cap.',
  };
  console.log(`RESUME: retaining ${restored.attempted} attempted cells; ${restored.pending} remain. Prior outcomes, including FAIL, are not retried.`);
}
let latestReportFile = path.join(root, 'report.json');
let warnedJsonFallback = false, warnedMarkdownFallback = false;
async function checkpoint() {
  for (const row of report.results) row.partialComposite = partialComposite(row.scores);
  const json = JSON.stringify(report, (_name,value) => typeof value === 'string' ? redact(value,key) : value, 2);
  const saved = await persistCheckpoint(path.join(root, 'report.json'), json);
  latestReportFile = saved.file;
  if (!saved.canonical && !warnedJsonFallback) {
    console.warn(`Report replacement blocked (${saved.renameError}); complete JSON saved as ${path.relative(process.cwd(), saved.file)}. Final output identifies the newest reportFile.`);
    warnedJsonFallback = true;
  }
  try {
    const md = benchmarkMarkdown(report) + (report.resume ? `\nContinuation started ${report.resume.startedAt}; retained attempts: ${report.resume.retainedAttempts}; historical reservations remain in the same total cap.\n` : '');
    const savedMarkdown = await persistCheckpoint(path.join(root, 'report.md'), redact(md, key));
    if (!savedMarkdown.canonical && !warnedMarkdownFallback) {
      console.warn('Markdown replacement blocked; JSON checkpoint remains authoritative.');
      warnedMarkdownFallback = true;
    }
  } catch (error) {
    if (!warnedMarkdownFallback) console.warn(`Markdown save failed (${error.code || 'IO_ERROR'}); complete JSON checkpoint already saved.`);
    warnedMarkdownFallback = true;
  }
}
async function preflight() {
  const started = Date.now(); report.metadataRequests++;
  const row = { url: modelsUrl, sentAuthorization: Boolean(key), httpStatus: null, durationMs: null, status: 'BLOCKED', advisoryOnly: true };
  try {
    const response = await fetch(modelsUrl, { headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    row.httpStatus = response.status;
    if (!response.ok) {
      row.status = 'FAIL'; row.providerError = await readGatewayError(response, key);
      row.reason = `Metadata HTTP ${response.status}; direct POST eligibility is decided independently by approval, key, cap and pricing.`;
    } else {
      const data = JSON.parse(await boundedResponseText(response, 1_000_000));
      if (!Array.isArray(data.data) || data.data.some(m => typeof m?.id !== 'string')) throw new Error('Unrecognized model metadata.');
      row.modelIds = data.data.map(m => m.id); row.status = 'PASS';
    }
  } catch (error) { row.reason = redact(error.message, key); }
  row.durationMs = Date.now() - started; return row;
}

await checkpoint();
let stopReason = planOnly ? 'PLAN_ONLY: no network or generation requested.'
  : !key ? 'SUMOPOD_API_KEY is not configured.'
  : !report.approved ? 'AET_LIVE_TEST_APPROVED=true is required for paid tests.'
  : !guard.allowed ? guard.reason : !pricing.allowed ? pricing.reason : '';

const inherited = inheritedCircuit(report.results);
if (!stopReason && inherited.stopReason) stopReason = inherited.stopReason;
const schedule = scheduleRemaining(report, maxRequests, report.localEstimatedBudgetUsd ?? 0);
report.scheduledRequests = stopReason ? report.modelRequests : schedule.scheduledRequests;
report.estimatedScheduledCeilingUsd = pricing.allowed && guard.allowed ? schedule.plannedCost : null;
if (previous && !stopReason && schedule.scheduled.size) {
  // An immutable claim prevents repeating this original recovery command after
  // a continuation already dispatched more calls. Resume its NEW checkpoint.
  const claim = path.join(path.dirname(resumeFile), `resume-claim-${report.resume.sourceSha256.slice(0, 24)}.json`);
  try {
    await fs.writeFile(claim, JSON.stringify({sourceFile:resumeFile,continuationRoot:root,startedAt},null,2), {flag:'wx',mode:0o600});
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const used = JSON.parse(await fs.readFile(claim,'utf8'));
    throw new Error(`This source report already has a continuation. Do not replay it; resume the newest report.json or report-checkpoint-*.json inside ${used.continuationRoot}.`);
  }
}
if (!stopReason && !planOnly && key && schedule.scheduled.size) report.preflight = await preflight();
const unavailableModels = inherited.unavailableModels;
for (let index = 0; index < report.results.length; index++) {
  const row = report.results[index];
  if (row.attempted) continue; // Never replay success, failure, or an uncertain in-flight attempt.
  row.metadataListed = Array.isArray(report.preflight?.modelIds) ? report.preflight.modelIds.includes(row.model) : null;
  if (stopReason) { row.reason = stopReason; continue; }
  if (!schedule.scheduled.has(`${row.model}:${row.caseId}`)) { row.reason = 'Balanced request/pricing reserve limit: this entire scenario wave was not scheduled.'; continue; }
  if (unavailableModels.has(row.model)) { row.reason = unavailableModels.get(row.model); continue; }
  if (report.recordedTokens >= report.maxReportedTokens) { stopReason = 'Reported-token guard reached; no further requests sent.'; row.reason = stopReason; continue; }
  const started = Date.now(); report.modelRequests++; row.attempted = true;
  report.estimatedCostReservedUsd += row.costEstimate.estimatedCeilingUsd;
  row.reason = 'ATTEMPT_IN_FLIGHT: dispatch intent recorded; never automatically replay this cell.';
  report.usageUnknownRequests++;
  // Persist intent and cost BEFORE dispatch; a crash cannot silently duplicate a paid call.
  await checkpoint();
  row.reason = undefined;
  try {
    const response = await fetch(row.request.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(row.request.body), redirect: 'error', signal: AbortSignal.timeout(45000) });
    row.httpStatus = response.status;
    if (!response.ok) {
      row.providerError = await readGatewayError(response, key); row.status = 'FAIL'; row.error = `Provider HTTP ${response.status} (${row.providerError.kind})`;
      if ([401, 402, 403, 429].includes(response.status)) stopReason = row.error + '; circuit opened, no automatic retry.';
      else if ([400, 404, 422].includes(response.status)) unavailableModels.set(row.model, row.error + '; this exact model not retried in this run.');
    } else if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.body?.cancel(); row.status = 'FAIL'; row.error = 'Provider did not return SSE.';
    } else {
      let text = '';
      try {
        for await (const delta of parseOpenAITextStream(response, { expectedModel: row.model, readUsageAfterStop: true, onMetadata(meta) {
          if (meta.model) row.reportedModel = meta.model;
          if (meta.finishReason) row.finishReason = meta.finishReason;
          if (meta.usage && Object.keys(meta.usage).length) row.usage = meta.usage;
        } })) {
          text += delta;
          if (text.length > 64_000) throw new StreamFailure('Benchmark output exceeds bound.');
        }
        report.completedRequests++;
        const evaluation = evaluateOutput(cases.find(c => c.id === row.caseId), text);
        Object.assign(row, evaluation); row.scores.streaming_integration = row.reportedModel === row.model && row.finishReason === 'stop' ? 5 : null;
        row.status = row.reportedModel !== row.model ? 'INCONCLUSIVE' : evaluation.objectiveStatus === 'FAIL' ? 'FAIL' : evaluation.qualitativeReview === 'REQUIRED' ? 'INCONCLUSIVE' : 'PASS';
        if (row.reportedModel !== row.model) row.reason = 'Requested model identity was not reported; model-specific conclusions remain inconclusive.';
        else if (evaluation.qualitativeReview === 'REQUIRED') row.reason = 'Objective constraints recorded; qualitative persona review still required.';
      } finally { row.output = redact(text, key); }
    }
  } catch (error) {
    row.status = error instanceof StreamFailure ? 'FAIL' : 'BLOCKED'; row.error = redact(error.message, key);
    if (error instanceof StreamFailure) row.scores.streaming_integration = 0;
    else if (error.name === 'TimeoutError') unavailableModels.set(row.model, 'Timed out once; remaining cases for this model were not sent automatically.');
    else stopReason = 'Transport/runtime failure; circuit opened without retries: ' + row.error;
  }
  row.durationMs = Date.now() - started;
  if (row.usage?.total_tokens !== undefined) { report.recordedTokens += row.usage.total_tokens; report.usageUnknownRequests--; }
  await checkpoint();
  console.log(`${row.model} ${row.caseId}: ${row.status}`);
}
report.status = report.results.every(r => r.status === 'BLOCKED') ? 'BLOCKED' : report.results.some(r => r.status === 'FAIL') ? 'FAIL' : report.results.every(r => r.status === 'PASS') ? 'PASS' : 'INCONCLUSIVE';
report.finishedAt = new Date().toISOString();
await checkpoint();
console.log(JSON.stringify({ report: path.relative(process.cwd(), root), reportFile: path.relative(process.cwd(), latestReportFile), retainedRequests: report.resume?.retainedAttempts ?? 0, newRequests: report.modelRequests - (report.resume?.retainedAttempts ?? 0), status: report.status, sourceKind: report.sourceKind, modelRequests: report.modelRequests, completedRequests: report.completedRequests, metadataRequests: report.metadataRequests, recordedTokens: report.recordedTokens, actualCostUsd: null }));
// A successful plan is a valid dry run, not a claim that any model passed.
if (!planOnly && report.status !== 'PASS') process.exitCode = 2;
