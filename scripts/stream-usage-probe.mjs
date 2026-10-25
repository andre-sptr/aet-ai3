/** Operator diagnostic. Default PLAN sends zero requests; --live sends at most two. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildSumopodChatRequest, parseOpenAITextStream } from '../lib/sumopod.ts';
import { loadBudgetGuard, loadPricing, estimateRequestCost, redact } from './benchmark-core.mjs';

const MODELS = ['gpt-4o-mini', 'gpt-5.4-mini', 'deepseek-v4-flash'];
const BASE_URL = 'https://ai.sumopod.com/v1';
const numericUsage = value => {
  const usage = Object.fromEntries(['prompt_tokens', 'completion_tokens', 'total_tokens']
    .filter(k => Number.isFinite(value?.[k]) && value[k] >= 0).map(k => [k, value[k]]));
  return Object.keys(usage).length ? usage : null;
};
const completeUsage = usage => Number.isFinite(usage?.prompt_tokens) && Number.isFinite(usage?.completion_tokens);

export async function inspectUsageStream(raw, modelId) {
  const wireUsage = [], wireUsageFieldNames = new Set();
  let wireUsageObjects = 0;
  for (const frame of raw.split(/\r?\n\r?\n/)) {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data.trim() === '[DONE]') continue;
    let value;
    try { value = JSON.parse(data); } catch { continue; }
    if (value?.usage && typeof value.usage === 'object') {
      wireUsageObjects++;
      for (const name of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'input_tokens', 'output_tokens']) {
        if (Object.hasOwn(value.usage, name)) wireUsageFieldNames.add(name);
      }
      const usage = numericUsage(value.usage);
      if (usage) wireUsage.push(usage);
    }
  }
  let parserUsage = null, reportedModel = null, output = '', parserError = null;
  try {
    const response = new Response(raw, { headers: { 'Content-Type': 'text/event-stream' } });
    for await (const delta of parseOpenAITextStream(response, {
      expectedModel: modelId, readUsageAfterStop: true,
      onMetadata: meta => {
        if (meta.model) reportedModel = meta.model;
        if (numericUsage(meta.usage)) parserUsage = { ...parserUsage, ...numericUsage(meta.usage) };
      },
    })) output += delta;
  } catch (error) { parserError = error instanceof Error ? error.message : 'Stream parsing failed.'; }
  return {
    wireUsageObjects, wireUsageFieldNames: [...wireUsageFieldNames], wireUsage,
    parserUsage, completeUsage: completeUsage(parserUsage), reportedModel,
    outputCharacters: output.length, outputMatchesProbe: output.trim() === 'AET OK', parserError,
  };
}

export async function runUsageProbe({ live = false, modelId = 'gpt-4o-mini', env = process.env, fetcher = globalThis.fetch, checkpoint = async () => {} } = {}) {
  if (!MODELS.includes(modelId)) throw new Error('Choose one supported public diagnostic model: ' + MODELS.join(', '));
  const report = {
    schemaVersion: 1, kind: 'stream-usage-diagnostic', sourceKind: live ? 'live' : 'PLAN_ONLY',
    planOnly: !live, modelId, startedAt: new Date().toISOString(), status: live ? 'RUNNING' : 'PLAN_ONLY',
    maximumRequests: 2, maximumOutputTokensPerRequest: 64, modelRequests: 0,
    reservedCostEstimateUsd: 0, actualBilledCostUsd: null, productionCalibrationEvidence: false,
    results: [false, true].map(includeUsage => {
      const outbound = buildSumopodChatRequest({
        apiKey: 'PLAN_PLACEHOLDER', baseUrl: BASE_URL, modelId, mode: 'daily', maxTokens: 64,
        systemInstruction: 'Follow the exact output requested by the user.',
        messages: [{ role: 'user', content: 'Reply only: AET OK' }],
      });
      const body = JSON.parse(outbound.init.body);
      if (includeUsage) body.stream_options = { include_usage: true };
      else delete body.stream_options; // Preserve a real control after the app starts requesting usage.
      return { caseId: includeUsage ? 'request-usage' : 'without-usage-option', requestedIncludeUsage: includeUsage, requestBody: body, status: 'NOT_RUN', httpStatus: null, usageBasedCostUsd: null };
    }),
    caveats: [
      'This diagnostic does not rank model quality or qualify a production routing policy.',
      'Provider key cap and prices are operator attestations checked by the existing repository guard.',
      'The existing key spending cap still covers earlier runs; this diagnostic does not reset it.',
      'Observed token usage and usage-derived cost are distinct from the actual provider bill.',
      'No headers, API keys, raw SSE, or private reasoning fields are stored.',
    ],
  };
  await checkpoint(report);
  if (!live) return report;
  const guard = await loadBudgetGuard(env), pricing = await loadPricing(env, [modelId]);
  report.guard = { allowed: guard.allowed, keyBound: guard.keyBound ?? false, hardLimitUsd: guard.hardLimitUsd ?? null, reason: guard.reason ?? null };
  report.pricing = { allowed: pricing.allowed, reason: pricing.reason ?? null };
  let halted = env.AET_LIVE_TEST_APPROVED !== 'true' ? 'AET_LIVE_TEST_APPROVED must be true after provider verification.'
    : (env.SUMOPOD_BASE_URL || BASE_URL).replace(/\/+$/, '') !== BASE_URL ? 'Only the key-bound official gateway is allowed.'
    : !guard.allowed ? guard.reason : !pricing.allowed ? pricing.reason : null;
  const reserveCap = guard.allowed ? guard.hardLimitUsd * 0.8 : 0;
  for (const row of report.results) {
    if (halted) { row.status = 'BLOCKED'; row.reason = halted; continue; }
    const estimate = estimateRequestCost(row.requestBody, pricing);
    if (!estimate || report.reservedCostEstimateUsd + estimate.estimatedCeilingUsd > reserveCap) {
      row.status = 'BLOCKED'; row.reason = halted = 'Verified budget cannot reserve the next attempt.'; continue;
    }
    row.status = 'DISPATCHING';
    row.startedAt = new Date().toISOString();
    row.reservedCostEstimateUsd = estimate.estimatedCeilingUsd;
    report.modelRequests++;
    report.reservedCostEstimateUsd += estimate.estimatedCeilingUsd;
    await checkpoint(report); // Persist dispatch before any potentially billed request.
    const start = Date.now();
    try {
      const response = await fetcher(BASE_URL + '/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.SUMOPOD_API_KEY },
        body: JSON.stringify(row.requestBody), signal: AbortSignal.timeout(20_000), redirect: 'error', cache: 'no-store',
      });
      row.httpStatus = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        row.status = 'HTTP_ERROR'; row.reason = 'Provider HTTP ' + response.status + '; no automatic retry.';
        halted = row.reason;
      } else if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        await response.body?.cancel();
        row.status = 'STREAM_ERROR'; row.reason = halted = 'Expected text/event-stream.';
      } else {
        const raw = await response.text();
        if (Buffer.byteLength(raw, 'utf8') > 256_000) throw new Error('Diagnostic response exceeds bound.');
        Object.assign(row, await inspectUsageStream(raw, modelId));
        row.status = row.parserError ? 'STREAM_ERROR' : row.completeUsage ? 'USAGE_CAPTURED' : 'USAGE_MISSING';
        if (row.parserError) halted = row.parserError;
        if (row.completeUsage) {
          const rate = pricing.models[modelId];
          row.usageBasedCostUsd = (row.parserUsage.prompt_tokens * rate.inputUsdPerMillion + row.parserUsage.completion_tokens * rate.outputUsdPerMillion) / 1e6;
        }
      }
    } catch (error) {
      row.status = 'ERROR'; row.reason = halted = redact(error instanceof Error ? error.message : 'Diagnostic request failed.', env.SUMOPOD_API_KEY);
    }
    row.durationMs = Date.now() - start;
    await checkpoint(report);
  }
  const [base, requested] = report.results;
  report.status = report.results.every(r => r.status === 'BLOCKED') ? 'BLOCKED'
    : report.results.some(r => ['HTTP_ERROR', 'STREAM_ERROR', 'ERROR', 'BLOCKED'].includes(r.status)) ? 'HAS_FAILURES' : 'COMPLETE';
  report.diagnosis = requested.completeUsage ? base.completeUsage ? 'USAGE_PRESENT_IN_BOTH_VARIANTS' : 'USAGE_CAPTURED_WITH_INCLUDE_USAGE'
    : requested.wireUsage?.some(completeUsage) ? 'WIRE_USAGE_NOT_CAPTURED_BY_PRODUCTION_PARSER'
    : requested.httpStatus === 400 ? 'INCLUDE_USAGE_REQUEST_REJECTED'
    : requested.status === 'USAGE_MISSING' ? 'NO_COMPLETE_USAGE_IN_EXPECTED_FIELDS' : 'PROBE_INCOMPLETE';
  report.finishedAt = new Date().toISOString();
  await checkpoint(report);
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  let live = false, modelId = 'gpt-4o-mini', out;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--live') live = true;
    else if (['--model', '--out'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) {
      if (args[i] === '--model') modelId = args[++i]; else out = args[++i];
    } else throw new Error('Usage: stream-usage-probe.mjs [--live] [--model PUBLIC_MODEL] [--out NEW_DIRECTORY]');
  }
  const root = out || path.join('evaluation', 'usage-probe-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
  await fs.mkdir(root, { recursive: true });
  const reportPath = path.join(root, 'report.json');
  await fs.writeFile(reportPath, '', { flag: 'wx' }); // Never overwrite earlier evidence.
  const checkpoint = report => fs.writeFile(reportPath, redact(JSON.stringify(report, null, 2), process.env.SUMOPOD_API_KEY));
  const report = await runUsageProbe({ live, modelId, checkpoint });
  console.log(JSON.stringify({
    status: report.status, sourceKind: report.sourceKind, modelRequests: report.modelRequests,
    diagnosis: report.diagnosis ?? null, report: reportPath,
    results: report.results.map(r => ({ caseId: r.caseId, status: r.status, httpStatus: r.httpStatus, usage: r.parserUsage ?? null })),
  }));
  if (live && report.status !== 'COMPLETE') process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(redact(error instanceof Error ? error.message : String(error), process.env.SUMOPOD_API_KEY)); process.exitCode = 1; });
}
