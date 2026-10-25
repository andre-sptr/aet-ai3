import { ApiError } from '../http.ts';
import type { ModePolicy } from './mode-policy.ts';
import type { DrainOutcome } from '../sumopod.ts';

export type CallRole = 'planner' | 'worker' | 'answer' | 'verifier' | 'revision' | 'classifier' | 'summary';
export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
export type Rates = Record<string, { inputUsdPerMillion: number; outputUsdPerMillion: number }>;
export type Attempt = {
  role: CallRole; model: string; inputEstimate: number; outputLimit: number;
  status: 'reserved' | 'complete' | 'failed'; usage: Usage | null;
  estimatedCeilingUsd: number | null; usageBasedCostUsd: number | null;
  reportedModel: string | null; durationMs: number | null; errorCode?: string;
  httpStatus?: number | null; finishReason?: string | null; metadataDrain?: DrainOutcome;
  usageRequested?: boolean;
  usageUnknownReason?: 'not_requested' | 'not_sent' | 'not_observed_before_eof' | 'stream_interrupted' | 'reading_ended_early' | 'partial_usage' | null;
};
export class BudgetExceeded extends ApiError {
  constructor(detail = 'Anggaran pemrosesan habis.') { super(429, detail, 'BUDGET_EXHAUSTED'); }
}
// UTF-8 bytes + framing is a deliberately conservative text-token estimate, not
// a tokenizer or provider billing measurement. Images receive a separate reserve.
export function estimateInput(messages: unknown): number {
  return new TextEncoder().encode(JSON.stringify(messages)).length + 1_024;
}
export class RequestBudget {
  readonly attempts: Attempt[] = [];
  toolCalls = 0;
  revisions = 0;
  private inputReserved = 0;
  private outputReserved = 0;
  private costReserved = 0;
  readonly startedAt = Date.now();
  finalModel = '';
  readonly policy: ModePolicy;
  readonly signal: AbortSignal;
  readonly rates: Rates;
  readonly maxUsd: number | null;
  constructor(policy: ModePolicy, signal: AbortSignal, rates: Rates = {}, maxUsd: number | null = null) {
    this.policy=policy; this.signal=signal; this.rates=rates; this.maxUsd=maxUsd;
    if (maxUsd !== null && (!Number.isFinite(maxUsd) || maxUsd <= 0)) throw new ApiError(503, 'Batas biaya server tidak valid.', 'BUDGET_CONFIG');
  }
  remainingMs(): number { return this.policy.deadlineMs - (Date.now() - this.startedAt); }
  check(): void {
    this.signal.throwIfAborted();
    if (this.remainingMs() <= 0) throw new ApiError(504, 'Batas waktu pemrosesan tercapai.', 'DEADLINE');
  }
  canReserve(input: number, output: number, keepFinal = false, model = ''): boolean {
    const finalInput = keepFinal ? this.policy.contextTokens : 0;
    const finalOutput = keepFinal ? this.policy.finalOutputTokens : 0;
    const rate = this.rates[model];
    const cost = rate ? (input * rate.inputUsdPerMillion + output * rate.outputUsdPerMillion) / 1e6 : null;
    const finalRate = this.rates[this.finalModel || model];
    const finalCost = keepFinal && finalRate ? (finalInput * finalRate.inputUsdPerMillion + finalOutput * finalRate.outputUsdPerMillion) / 1e6 : 0;
    return !this.signal.aborted && this.remainingMs() > (keepFinal ? 8_000 : 0)
      && this.attempts.filter(a => a.status === 'reserved').length < this.policy.concurrency
      && this.attempts.length + 1 + Number(keepFinal) <= this.policy.maxAttempts
      && this.inputReserved + input + finalInput <= this.policy.inputTokens
      && this.outputReserved + output + finalOutput <= this.policy.outputTokens
      && (this.maxUsd === null || cost !== null && (!keepFinal || Boolean(finalRate)) && this.costReserved + cost + finalCost <= this.maxUsd);
  }
  reserve(role: CallRole, model: string, input: number, output: number, keepFinal = false): Attempt {
    this.check();
    if (!this.canReserve(input, output, keepFinal, model)) throw new BudgetExceeded();
    const rate = this.rates[model];
    const cost = rate ? (input * rate.inputUsdPerMillion + output * rate.outputUsdPerMillion) / 1e6 : null;
    const attempt: Attempt = { role, model, inputEstimate: input, outputLimit: output, status: 'reserved', usage: null, estimatedCeilingUsd: cost, usageBasedCostUsd: null, reportedModel: null, durationMs: null };
    this.attempts.push(attempt);
    // Retain reservations even on failure/missing usage: a failed transport may
    // still have incurred provider work. Retry consumes another full reservation.
    this.inputReserved += input; this.outputReserved += output; this.costReserved += cost ?? 0;
    return attempt;
  }
  tool(): void { this.check(); if (this.toolCalls >= this.policy.maxToolCalls) throw new BudgetExceeded('Batas alat tercapai.'); this.toolCalls++; }
  revision(): void { this.check(); if (this.revisions >= this.policy.maxRevisions) throw new BudgetExceeded('Batas revisi tercapai.'); this.revisions++; }
  snapshot() {
    const usages = this.attempts.map(a => a.usage);
    const completeUsage = this.attempts.length > 0 && usages.every(u => u?.prompt_tokens !== undefined && u?.completion_tokens !== undefined);
    const knownUsage = this.attempts.filter(a => a.usage?.prompt_tokens !== undefined && a.usage?.completion_tokens !== undefined);
    const knownCosts = this.attempts.filter(a => a.usageBasedCostUsd !== null);
    return { attempts: this.attempts.map(a => ({ ...a })), llmAttempts: this.attempts.length, toolCalls: this.toolCalls, revisions: this.revisions,
      inputReserved: this.inputReserved, outputReserved: this.outputReserved,
      usage: completeUsage ? { inputTokens: usages.reduce((n,u) => n + u!.prompt_tokens!, 0), outputTokens: usages.reduce((n,u) => n + u!.completion_tokens!, 0) } : null,
      usageBasedCostUsd: completeUsage && this.attempts.every(a => a.usageBasedCostUsd !== null) ? this.attempts.reduce((n,a) => n + a.usageBasedCostUsd!, 0) : null,
      usageCoverage: { known: knownUsage.length, attempted: this.attempts.length, unknown: this.attempts.length - knownUsage.length },
      costCoverage: { known: knownCosts.length, attempted: this.attempts.length, unknown: this.attempts.length - knownCosts.length },
      knownUsageBasedCostSubtotalUsd: knownCosts.length ? knownCosts.reduce((n,a) => n + a.usageBasedCostUsd!, 0) : null,
      actualBilledCostUsd: null, estimatedReservedCostUsd: this.attempts.length && this.attempts.every(a => a.estimatedCeilingUsd !== null) ? this.costReserved : null,
      tokenAccounting: 'conservative_text_bytes_plus_image_estimate', visionTokenAccounting:'estimate_not_gateway_calibrated', elapsedMs: Date.now() - this.startedAt };
  }
}
