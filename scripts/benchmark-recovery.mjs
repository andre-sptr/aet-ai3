import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { estimateRequestCost } from './benchmark-core.mjs';

// Keep a complete, independently readable snapshot if Windows refuses replacement.
// Never unlink the old destination or truncate it as a rename fallback.
export async function persistCheckpoint(file, text, { io = fs, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), retries = 5 } = {}) {
  const snapshot = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}-checkpoint-${Date.now()}-${randomUUID().slice(0, 8)}${path.extname(file)}`);
  await io.writeFile(snapshot, text, { flag: 'wx', mode: 0o600 });
  for (let attempt = 0; ; attempt++) {
    try {
      await io.rename(snapshot, file);
      return { file, canonical: true };
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= retries) {
        return { file: snapshot, canonical: false, renameError: error.code || 'RENAME_FAILED' };
      }
      await pause(100 * 2 ** attempt);
    }
  }
}

const count = (value, name, max) => {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`Resume rejected: invalid ${name}.`);
};

export function restoreResults(previous, expected, currentKeyHash) {
  const reject = message => { throw new Error(`Resume rejected: ${message}`); };
  if (previous?.schemaVersion !== 2 || previous.planOnly !== false || previous.sourceKind !== expected.sourceKind) reject('a matching, non-plan schema-v2 report is required.');
  for (const field of ['datasetSha256', 'productionPromptSha256', 'requestedOutputCap', 'plannedRequests', 'maxReportedTokens', 'budgetReserveFraction']) {
    if (!isDeepStrictEqual(previous[field], expected[field])) reject(`${field} changed; do not mix different benchmark protocols.`);
  }
  if (!isDeepStrictEqual(previous.models, expected.models) || !Array.isArray(previous.results) || previous.results.length !== expected.results.length) reject('model catalogue or result matrix changed.');
  if (previous.benchmarkKeySha256 && previous.benchmarkKeySha256 !== currentKeyHash) reject('the dedicated provider key changed.');
  if (previous.sourceKind === 'live' && (previous.budgetGuard?.allowed !== true || previous.budgetGuard?.keyBound !== true)) reject('source report lacks a verified key-bound cap.');
  if (previous.pricing?.allowed !== true) reject('source report lacks verified rates.');
  if (expected.pricing.allowed && !isDeepStrictEqual(previous.pricing.models, expected.pricing.models)) reject('rates changed; keep this continuation comparable or start a separately budgeted run.');
  let attempted = 0, completed = 0, tokens = 0, unknown = 0, reserved = 0;
  for (let i = 0; i < expected.results.length; i++) {
    const old = previous.results[i], fresh = expected.results[i];
    for (const field of ['model', 'caseId', 'category', 'mode', 'request', 'reference', 'failureConditions']) {
      if (!isDeepStrictEqual(old?.[field], fresh[field])) reject(`request or fixture changed at cell ${i + 1} (${field}).`);
    }
    if (typeof old.attempted !== 'boolean' || !['PASS', 'FAIL', 'INCONCLUSIVE', 'BLOCKED'].includes(old.status)) reject(`invalid cell ${i + 1}.`);
    if (!old.attempted) {
      if (old.status !== 'BLOCKED' || old.output != null || old.httpStatus != null || old.error) reject('unattempted cell contains an execution result.');
      continue;
    }
    const cost = estimateRequestCost(old.request.body, previous.pricing);
    if (!cost || !isDeepStrictEqual(cost, old.costEstimate)) reject('historical cost reservation does not match source rates.');
    reserved += cost.estimatedCeilingUsd;
    attempted++;
    if (Array.isArray(old.checks)) completed++;
    if (old.usage?.total_tokens !== undefined) {
      if (!Number.isFinite(old.usage.total_tokens) || old.usage.total_tokens < 0) reject('invalid reported usage.');
      tokens += old.usage.total_tokens;
    } else unknown++;
  }
  count(previous.modelRequests, 'modelRequests', expected.results.length);
  count(previous.completedRequests, 'completedRequests', attempted);
  count(previous.metadataRequests, 'metadataRequests', 10000);
  if (previous.modelRequests !== attempted || previous.completedRequests !== completed || previous.recordedTokens !== tokens || previous.usageUnknownRequests !== unknown) reject('historical request/usage counters are inconsistent.');
  if (!Number.isFinite(previous.estimatedCostReservedUsd) || Math.abs(previous.estimatedCostReservedUsd - reserved) > 1e-8) reject('historical cost reservations are inconsistent.');
  if (attempted > expected.maxRequests) reject('request ceiling is lower than the attempts already consumed.');
  expected.results = expected.results.map((fresh, i) => previous.results[i].attempted ? structuredClone(previous.results[i]) : fresh);
  for (const name of ['modelRequests', 'completedRequests', 'metadataRequests', 'recordedTokens', 'usageUnknownRequests', 'estimatedCostReservedUsd']) expected[name] = previous[name];
  return { attempted, pending: expected.results.length - attempted };
}

export function inheritedCircuit(rows) {
  let stopReason = '';
  const unavailableModels = new Map();
  for (const row of rows.filter(row => row.attempted)) {
    if ([401, 402, 403, 429].includes(row.httpStatus)) stopReason = 'Previous provider authorization/payment/rate-limit circuit remains open; no automatic continuation.';
    else if ([400, 404, 422].includes(row.httpStatus)) unavailableModels.set(row.model, 'This exact model was rejected earlier; no automatic retry.');
    else if (row.status === 'BLOCKED' && row.error) stopReason = 'Previous transport/runtime failure requires review; no automatic continuation.';
  }
  return { stopReason, unavailableModels };
}

export function scheduleRemaining(report, maxRequests, budgetUsd) {
  let plannedCost = report.estimatedCostReservedUsd;
  let scheduledRequests = report.modelRequests;
  const scheduled = new Set();
  for (let start = 0; start < report.results.length; start += report.models.length) {
    const pending = report.results.slice(start, start + report.models.length).filter(row => !row.attempted);
    const cost = pending.reduce((sum, row) => sum + (row.costEstimate?.estimatedCeilingUsd ?? Infinity), 0);
    if (scheduledRequests + pending.length > maxRequests || plannedCost + cost > budgetUsd) break;
    for (const row of pending) scheduled.add(`${row.model}:${row.caseId}`);
    plannedCost += cost;
    scheduledRequests += pending.length;
  }
  return { scheduled, scheduledRequests, plannedCost };
}
