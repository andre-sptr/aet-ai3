import { getModelById } from '../ai-models.ts';
import { DEFAULT_SUMOPOD_MODEL } from '../sumopod.ts';
import type { ChatMode } from '../../types/index.ts';

export type RoutingMode = 'off' | 'shadow' | 'adaptive';
export type TaskCategory = 'daily' | 'academic' | 'coding' | 'reasoning' | 'long-context' | 'uncertain';
export type RoutingInput = {
  manualModelId?: string; mode: ChatMode; text: string; contextChars: number;
  hasDocument?: boolean; hasImages?: boolean; frontierAllowed?: boolean;
};
export type RoutingEvidence = {
  modelId: string; category: TaskCategory; sourceKind: 'live'; reportRef: string;
  comparisonSet: string; caseIds: string[]; sampleCount: number; verifiedAt: string;
  objectivePassRate: number; contextPassRate: number; instructionPassRate: number; streamingSuccessRate: number;
  qualitativeReview: { status: 'approved'; reviewer: string; score: number };
  p95LatencyMs: number; costUsdPerRequest: number; costVerified: boolean;
  maxTestedInputChars: number;
};
export type RoutingPolicy = {
  schemaVersion: 1; datasetSha256: string; evidence: RoutingEvidence[];
  maxLatencyMs: number; maxCostUsdPerRequest: number;
};
export type RoutingDecision = {
  mode: RoutingMode; category: TaskCategory; modelId: string; recommendedModelId: string | null;
  reason: 'manual_selection' | 'routing_off' | 'insufficient_evidence' | 'shadow_recommendation' | 'qualified_evidence';
  evidenceRef: string | null;
};

/** Inspect direct user instructions; document contents are never used as routing commands. */
export function classifyTask(input: RoutingInput): TaskCategory {
  if (input.contextChars >= 24_000 || input.hasDocument) return 'long-context';
  if (input.mode === 'coding') return 'coding';
  if (input.mode === 'report') return 'academic';
  if (/\b(debug|stack\s*trace|typescript|javascript|python|kode|coding|program)\b/i.test(input.text)) return 'coding';
  if (/\b(kendala|constraints?|deduksi|buktikan|hitung|persamaan|optimasi|sebab.akibat)\b/i.test(input.text)) return 'reasoning';
  if (/\b(jurnal|akademik|penelitian|literatur|research)\b/i.test(input.text)) return 'academic';
  return input.text.trim() ? 'daily' : 'uncertain';
}
const rate = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function qualifies(e: RoutingEvidence, input: RoutingInput, category: TaskCategory, policy: RoutingPolicy, now: number): boolean {
  const model = getModelById(e?.modelId);
  const verified = Date.parse(e?.verifiedAt);
  return Boolean(model && model.availability === 'available' && (!model.isFrontier || input.frontierAllowed)
    && (!input.hasImages || model.supportsImageInput === true) && e.category === category && e.sourceKind === 'live'
    && typeof e.reportRef === 'string' && /^docs\/[\w./-]+\.json$/.test(e.reportRef) && !e.reportRef.includes('..')
    && /^[a-f0-9]{64}$/.test(e.comparisonSet) && Array.isArray(e.caseIds) && e.caseIds.length >= 3
    && e.caseIds.every(id => typeof id === 'string') && new Set(e.caseIds).size === e.caseIds.length
    && Number.isInteger(e.sampleCount) && e.sampleCount >= e.caseIds.length && e.sampleCount >= 3
    && Number.isFinite(verified) && verified <= now && now - verified <= 7 * 86_400_000
    && [e.objectivePassRate,e.contextPassRate,e.instructionPassRate,e.streamingSuccessRate].every(rate)
    && e.objectivePassRate >= 0.9 && e.contextPassRate >= 0.9 && e.instructionPassRate >= 0.9 && e.streamingSuccessRate === 1
    && e.qualitativeReview?.status === 'approved' && typeof e.qualitativeReview.reviewer === 'string' && e.qualitativeReview.reviewer.trim().length > 0
    && nonnegative(e.qualitativeReview.score) && e.qualitativeReview.score >= 4 && e.qualitativeReview.score <= 5
    && nonnegative(e.p95LatencyMs) && e.p95LatencyMs <= policy.maxLatencyMs
    && e.costVerified === true && nonnegative(e.costUsdPerRequest) && e.costUsdPerRequest <= policy.maxCostUsdPerRequest
    && Number.isInteger(e.maxTestedInputChars) && e.maxTestedInputChars >= input.contextChars);
}

export function routeModel(input: RoutingInput, mode: RoutingMode = 'off', policy?: RoutingPolicy, now = Date.now()): RoutingDecision {
  const category = classifyTask(input);
  const base = { mode, category, modelId: input.manualModelId || DEFAULT_SUMOPOD_MODEL, recommendedModelId: null, evidenceRef: null };
  if (input.manualModelId) return { ...base, reason: 'manual_selection' };
  if (mode === 'off') return { ...base, reason: 'routing_off' };
  if (!policy || policy.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(policy.datasetSha256) || !Array.isArray(policy.evidence)
    || !nonnegative(policy.maxLatencyMs) || !nonnegative(policy.maxCostUsdPerRequest)) return { ...base, reason: 'insufficient_evidence' };
  const candidates = policy.evidence.filter(e => qualifies(e, input, category, policy, now));
  const baseline = candidates.find(e => e.modelId === DEFAULT_SUMOPOD_MODEL);
  // The current default must be part of the same evaluated case set for any promotion.
  if (!baseline) return { ...base, reason: 'insufficient_evidence' };
  const comparable = candidates.filter(e => e.comparisonSet === baseline.comparisonSet
    && [...e.caseIds].sort().join('\n') === [...baseline.caseIds].sort().join('\n'));
  // Quality is the first gate. Cost and latency decide between equally strong measured candidates.
  comparable.sort((a,b) => b.objectivePassRate - a.objectivePassRate || b.qualitativeReview.score - a.qualitativeReview.score
    || a.costUsdPerRequest - b.costUsdPerRequest || a.p95LatencyMs - b.p95LatencyMs || a.modelId.localeCompare(b.modelId));
  const best = comparable[0];
  if (!best) return { ...base, reason: 'insufficient_evidence' };
  return { ...base, modelId: mode === 'adaptive' ? best.modelId : DEFAULT_SUMOPOD_MODEL,
    recommendedModelId: best.modelId, evidenceRef: best.reportRef,
    reason: mode === 'adaptive' ? 'qualified_evidence' : 'shadow_recommendation' };
}
