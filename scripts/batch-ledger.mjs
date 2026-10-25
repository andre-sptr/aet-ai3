import { estimateRequestCost } from './benchmark-core.mjs';
import { isDeepStrictEqual } from 'node:util';

/** One ledger for every model, role, retry and optional diagnostic. Reservations
 * are retained on failure. The dispatch checkpoint completes before fetch. */
export class BatchLedger {
  constructor(report, { pricing, maxRequests, capUsd, checkpoint }) {
    Object.assign(this,{report,pricing,maxRequests,capUsd,checkpoint});
    this.queue = Promise.resolve();
  }
  serial(run) {
    const next = this.queue.then(run);
    this.queue = next.catch(() => {});
    return next;
  }
  async reserve(sampleId, body, role = 'answer') {
    return this.serial(async () => {
      if (this.report.circuit) throw new Error(this.report.circuit);
      if (this.report.deadlineAt !== undefined && Date.now()>=this.report.deadlineAt) throw new Error(this.report.circuit='Global batch deadline reached.');
      if (this.report.recordedTokens >= this.report.maxReportedTokens) throw new Error(this.report.circuit='Global reported-token ceiling reached.');
      const cost = estimateRequestCost(body,this.pricing);
      if (this.report.modelRequests >= this.maxRequests) throw new Error(this.report.circuit = 'Global request ceiling reached.');
      if (!cost || this.report.reservedCostEstimateUsd + cost.estimatedCeilingUsd > this.capUsd) throw new Error(this.report.circuit = 'Global reservation ceiling reached.');
      const tokens=cost.inputTokenEstimate+cost.outputTokenLimit;
      if ((this.report.reservedTokens??0)+tokens>this.report.maxReservedTokens) throw new Error(this.report.circuit='Global reserved-token ceiling reached.');
      const attempt = { id:this.report.attempts.length+1,sampleId,model:body.model,role,body:structuredClone(body),cost,
        status:'DISPATCHING',httpStatus:null,startedAt:new Date().toISOString() };
      this.report.attempts.push(attempt);
      this.report.modelRequests++;
      this.report.reservedCostEstimateUsd += cost.estimatedCeilingUsd;
      this.report.reservedTokens=(this.report.reservedTokens??0)+tokens;
      await this.checkpoint();
      return attempt;
    });
  }
}

export function restoreBatch(previous, expected, pricing) {
  const reject = message => { throw new Error('Batch resume rejected: '+message); };
  if (previous?.kind !== expected.kind || previous.schemaVersion !== 1 || previous.planOnly !== false
    || previous.sourceKind !== expected.sourceKind || previous.protocolSha256 !== expected.protocolSha256
    || previous.keySha256 !== expected.keySha256) reject('source/protocol/key changed.');
  if (!Array.isArray(previous.results) || !Array.isArray(previous.attempts)
    || previous.results.length !== expected.results.length
    || previous.results.some((r,i) => r.sampleId !== expected.results[i].sampleId || typeof r.attempted !== 'boolean')) reject('sample matrix changed.');
  if (previous.sourceKind === 'live' && (previous.budgetGuard?.allowed !== true || previous.budgetGuard?.keyBound !== true)) reject('no historical key-bound provider guard.');
  if (previous.sourceKind === 'live' && expected.budgetGuard?.allowed && previous.budgetGuard.hardLimitUsd!==expected.budgetGuard.hardLimitUsd) reject('provider cap changed; do not reset a shared run budget.');
  if (pricing.allowed && !isDeepStrictEqual(previous.pricing?.models,pricing.models)) reject('rates changed.');
  let reserved = 0, reservedTokens=0,recordedTokens=0;
  const ids = new Set(previous.results.filter(r=>r.attempted).map(r=>r.sampleId));
  for (let i=0;i<previous.attempts.length;i++) {
    const a=previous.attempts[i], cost=estimateRequestCost(a.body,previous.pricing);
    if (a.id !== i+1 || !ids.has(a.sampleId) || !cost || !isDeepStrictEqual(a.cost,cost)
      || a.model !== a.body.model || !['DISPATCHING','RESPONDED','TRANSPORT_ERROR'].includes(a.status)) reject('invalid dispatch reservation.');
    reserved += cost.estimatedCeilingUsd;
    reservedTokens+=cost.inputTokenEstimate+cost.outputTokenLimit;
    if(a.usage&&Object.values(a.usage).some(v=>!Number.isSafeInteger(v)||v<0))reject('invalid reported usage.');
    recordedTokens+=a.usage?.total_tokens??((a.usage?.prompt_tokens??0)+(a.usage?.completion_tokens??0));
  }
  if (previous.modelRequests !== previous.attempts.length || !Number.isFinite(previous.reservedCostEstimateUsd)
    || Math.abs(reserved-previous.reservedCostEstimateUsd)>1e-9 || previous.modelRequests>expected.maxRequests
    || previous.reservedTokens!==reservedTokens||previous.recordedTokens!==recordedTokens||previous.deadlineAt!==expected.deadlineAt) reject('inconsistent global counters.');
  Object.assign(expected,{results:structuredClone(previous.results),attempts:structuredClone(previous.attempts),
    modelRequests:previous.modelRequests,reservedCostEstimateUsd:reserved,reservedTokens,recordedTokens,circuit:previous.circuit ?? null});
  expected.unavailableModels={...(previous.unavailableModels??{})};
  for(const a of previous.attempts)if([400,404,422].includes(a.httpStatus))expected.unavailableModels[a.model]='Inherited exact-model/request rejection; no automatic retry.';
  if (previous.attempts.some(a=>[401,402,403,429].includes(a.httpStatus))) expected.circuit='Inherited shared authorization/billing/rate-limit circuit.';
  if (previous.attempts.some(a=>a.status==='DISPATCHING'||a.status==='TRANSPORT_ERROR')) expected.circuit='Inherited uncertain or interrupted dispatch; manual review required, never replayed.';
  return {retainedSamples:expected.results.filter(r=>r.attempted).length,retainedAttempts:expected.modelRequests};
}
