import type { ResponseMode } from '../../types/index.ts';

export type ModePolicy = {
  maxAttempts: number; maxToolCalls: number; maxRevisions: number;
  inputTokens: number; outputTokens: number; contextTokens: number;
  finalOutputTokens: number; deadlineMs: number; concurrency: number;
};
export const MODE_POLICIES: Readonly<Record<ResponseMode, Readonly<ModePolicy>>> = {
  fast: { maxAttempts: 2, maxToolCalls: 2, maxRevisions: 0, inputTokens: 48_000, outputTokens: 4_096, contextTokens: 24_000, finalOutputTokens: 4_096, deadlineMs: 30_000, concurrency: 1 },
  normal: { maxAttempts: 4, maxToolCalls: 4, maxRevisions: 1, inputTokens: 120_000, outputTokens: 10_240, contextTokens: 32_000, finalOutputTokens: 4_096, deadlineMs: 45_000, concurrency: 1 },
  think: { maxAttempts: 6, maxToolCalls: 6, maxRevisions: 1, inputTokens: 200_000, outputTokens: 14_336, contextTokens: 40_000, finalOutputTokens: 4_096, deadlineMs: 55_000, concurrency: 2 },
};
export function normalizeResponseMode(value: unknown): ResponseMode {
  if (value === undefined) return 'normal';
  if (value === 'fast' || value === 'normal' || value === 'think') return value;
  throw new Error('responseMode harus fast, normal, atau think.');
}
/** Environment values may reduce ceilings. A timeout setting cannot extend hosting. */
export function modePolicy(mode: ResponseMode): ModePolicy {
  const base = MODE_POLICIES[mode];
  const deadline = Number(process.env.AET_CHAT_DEADLINE_MS);
  return { ...base, deadlineMs: Number.isFinite(deadline) && deadline >= 500 ? Math.min(base.deadlineMs, deadline) : base.deadlineMs };
}
