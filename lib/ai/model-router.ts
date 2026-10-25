import { getModelById } from '../ai-models.ts';
import { DEFAULT_SUMOPOD_MODEL } from '../sumopod.ts';
import type { ChatMode, ResponseMode } from '../../types/index.ts';
import type { CallRole } from './budget.ts';

export type RoutingMode = 'off' | 'shadow' | 'adaptive';
export type TaskCategory = 'daily' | 'academic' | 'coding' | 'reasoning' | 'long-context' | 'uncertain';
export type RoutingInput = {
  manualModelId?: string; mode: ChatMode; text: string; contextChars: number;
  latestText?: string; previousTaskText?: string; continuesTask?: boolean;
  responseMode?: ResponseMode; role?: CallRole; hasDocument?: boolean; hasImages?: boolean;
  complexity?: 'simple' | 'complex';
  hasToolEvidence?: boolean; frontierAllowed?: boolean; unavailableModelIds?: string[];
  inputTokensEstimate?: number; outputTokens?: number; remainingMs?: number;
  canUseModel?: (modelId: string) => boolean;
  requirementsForModel?: (modelId: string) => {inputTokens:number;outputTokens:number};
};
export type RoutingNeeds = {
  longContext: boolean; documents: boolean; images: boolean; toolEvidence: boolean;
  responseMode: ResponseMode; role: CallRole; complexity: 'simple' | 'complex';
};
/** Only the server loader constructs these metrics, from hash-bound raw samples. */
export type RoutingEvidence = {
  modelId: string; category: TaskCategory; sourceKind: 'live'; reportRef: string;
  comparisonSet: string; caseIds: string[]; sampleCount: number; independentRepeats: number;
  verifiedAt: string; provenanceValidated: true;
  objectivePassRate: number; contextPassRate: number; instructionPassRate: number | null; streamingSuccessRate: number;
  qualitativeReview: { status: 'completed'; authorKind: 'human'; reviewer: string; score: number } | null;
  p95LatencyMs: number; costUsdPerRequest: number | null; costVerified: boolean;
  maxTestedInputChars: number; maxTestedInputTokens: number; maxTestedOutputTokens: number;
  scope: { role: 'answer'; persona: ChatMode; complexity: 'simple' | 'complex'; responseMode: ResponseMode; documents: false; images: false; toolEvidence: false; longContext: false };
};
export type RoutingPolicy = {
  schemaVersion: 2; version: string; datasetSha256: string; evidence: RoutingEvidence[];
  maxLatencyMs: number; maxCostUsdPerRequest: number;
  rejectedEvidence?: {modelId:string;reason:string}[];
};
export type RoutingDecision = {
  mode: RoutingMode; category: TaskCategory; needs: RoutingNeeds; modelId: string | null;
  recommendedModelId: string | null; reason: 'routing_off' | 'insufficient_evidence' | 'shadow_recommendation' | 'qualified_evidence' | 'no_eligible_model' | 'evaluation_candidate';
  evidenceRef: string | null; policyVersion: string | null;
  calibration: 'uncalibrated_baseline' | 'reviewed_live_evidence' | 'no_eligible_model' | 'evaluation_only';
  baselineEligible: boolean; rejected: { modelId: string; reason: string }[];
};

/** Intent comes from direct user messages, never document contents or generated subgoals. */
export function classifyTask(input: RoutingInput): TaskCategory {
  const latest = (input.latestText ?? input.text).trim();
  const detect = (text: string): TaskCategory | undefined => {
    if (/\b(debug|stack\s*trace|typescript|javascript|python|kode|coding|program|fungsi|function|refactor|unit test|SQL|API)\b/i.test(text)) return 'coding';
    if (/\b(jurnal|akademik|penelitian|literatur|research|skripsi|disertasi|metodologi|academic|literature)\b/i.test(text)) return 'academic';
    if (/\b(kendala|constraints?|deduksi|buktikan|hitung|calculate|persamaan|optimasi|sebab.akibat|anggaran|diskon|probabilitas|persentase|jadwal unik|dapat dipastikan)\b/i.test(text)) return 'reasoning';
  };
  const explicit = detect(latest);
  if (explicit) return explicit;
  if (input.continuesTask) {
    const inherited = detect(input.previousTaskText ?? input.text);
    if (inherited) return inherited;
  }
  if (input.mode === 'coding') return 'coding';
  if (input.mode === 'report') return 'academic';
  return latest ? 'daily' : 'uncertain';
}
const rate = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function routingNeeds(input: RoutingInput): RoutingNeeds {
  return { longContext: input.contextChars >= 24_000, documents: Boolean(input.hasDocument), images: Boolean(input.hasImages),
    toolEvidence: Boolean(input.hasToolEvidence), responseMode: input.responseMode ?? 'normal', role: input.role ?? 'answer',complexity:input.complexity ?? 'simple' };
}
function incompatibility(id: string, input: RoutingInput): string | null {
  const model = getModelById(id);
  if (!model || model.availability !== 'available' || model.supportsStreaming !== true) return 'model_unavailable';
  if (input.unavailableModelIds?.includes(id)) return 'model_unhealthy';
  if (model.isFrontier && !input.frontierAllowed) return 'frontier_denied';
  if (input.hasImages && model.supportsImageInput !== true) return 'images_unverified';
  const required=input.requirementsForModel?.(id) ?? {inputTokens:input.inputTokensEstimate ?? 0,outputTokens:input.outputTokens ?? 0};
  if (required.inputTokens + required.outputTokens > Math.min(model.contextCapacity ?? 32_000, 128_000)) return 'context_capacity';
  if (input.remainingMs !== undefined && input.remainingMs <= 0) return 'deadline';
  if (input.canUseModel && !input.canUseModel(id)) return 'request_budget_or_capacity';
  return null;
}
/** A failed baseline can still be a valid experimental comparator. */
function validComparator(e: RoutingEvidence, category: TaskCategory, now: number): boolean {
  const verified = Date.parse(e?.verifiedAt);
  return Boolean(e?.provenanceValidated === true && getModelById(e.modelId) && e.sourceKind === 'live' && e.category === category
    && typeof e.reportRef === 'string' && /^(docs|evaluation)\/[\w./-]+\.json$/.test(e.reportRef) && !e.reportRef.includes('..')
    && hash(e.comparisonSet) && Array.isArray(e.caseIds) && e.caseIds.length >= 3
    && e.caseIds.every(id => typeof id === 'string' && id.length > 0) && new Set(e.caseIds).size === e.caseIds.length
    && Number.isInteger(e.sampleCount) && Number.isInteger(e.independentRepeats) && e.independentRepeats >= 3 && e.sampleCount >= e.caseIds.length * e.independentRepeats
    && Number.isFinite(verified) && verified <= now && now - verified <= 7 * 86_400_000
    && [e.objectivePassRate,e.contextPassRate,e.streamingSuccessRate].every(rate)
    && nonnegative(e.p95LatencyMs) && nonnegative(e.maxTestedInputChars) && nonnegative(e.maxTestedInputTokens) && nonnegative(e.maxTestedOutputTokens));
}
function rejection(e: RoutingEvidence, input: RoutingInput, needs: RoutingNeeds, category: TaskCategory, policy: RoutingPolicy, now: number): string | null {
  if (!validComparator(e, category, now)) return 'invalid_or_stale_evidence';
  const incompatible = incompatibility(e.modelId, input);
  if (incompatible) return incompatible;
  if (e.scope?.role !== needs.role || e.scope?.responseMode !== needs.responseMode || e.scope?.persona !== input.mode || e.scope?.complexity !== needs.complexity
    || needs.documents || needs.images || needs.toolEvidence || needs.longContext) return 'untested_scope';
  const required=input.requirementsForModel?.(e.modelId) ?? {inputTokens:input.inputTokensEstimate ?? 0,outputTokens:input.outputTokens ?? 0};
  if (e.maxTestedInputChars < input.contextChars || e.maxTestedInputTokens < required.inputTokens
    || e.maxTestedOutputTokens < required.outputTokens) return 'untested_input_or_output_extent';
  if (e.objectivePassRate < 0.9 || e.contextPassRate < 0.9 || !rate(e.instructionPassRate) || e.instructionPassRate < 0.9 || e.streamingSuccessRate !== 1) return 'quality_threshold';
  if (e.qualitativeReview?.status !== 'completed' || e.qualitativeReview.authorKind !== 'human' || typeof e.qualitativeReview.reviewer !== 'string' || !e.qualitativeReview.reviewer.trim()
    || !nonnegative(e.qualitativeReview.score) || e.qualitativeReview.score < 4 || e.qualitativeReview.score > 5) return 'human_review_missing_or_low';
  if (e.p95LatencyMs > policy.maxLatencyMs || e.p95LatencyMs > (input.remainingMs ?? Infinity)) return 'latency_or_deadline';
  if (!e.costVerified || !nonnegative(e.costUsdPerRequest) || e.costUsdPerRequest > policy.maxCostUsdPerRequest) return 'cost_unknown_or_over_limit';
  return null;
}

/** Internal operator evaluation only. HTTP payloads never reach this argument.
 * This is deliberately labelled uncalibrated and never fabricates policy metrics. */
export function evaluationRoute(input: RoutingInput, modelId: string): RoutingDecision {
  const rejected=incompatibility(modelId,input), base=routeModel(input,'off');
  return {...base,modelId:rejected?null:modelId,recommendedModelId:null,reason:rejected?'no_eligible_model':'evaluation_candidate',
    calibration:rejected?'no_eligible_model':'evaluation_only',policyVersion:null,evidenceRef:null,
    rejected:rejected?[{modelId:getModelById(modelId)?.id ?? 'unknown',reason:rejected}]:[]};
}

export function routeModel(input: RoutingInput, mode: RoutingMode = 'off', policy?: RoutingPolicy, now = Date.now()): RoutingDecision {
  const category = classifyTask(input), needs = routingNeeds(input);
  const baselineReason = incompatibility(DEFAULT_SUMOPOD_MODEL, input);
  const rejected: RoutingDecision['rejected'] = [...(policy?.rejectedEvidence ?? []),...(baselineReason ? [{modelId:DEFAULT_SUMOPOD_MODEL,reason:baselineReason}] : [])];
  const base: RoutingDecision = { mode,category,needs,modelId:baselineReason ? null : DEFAULT_SUMOPOD_MODEL,recommendedModelId:null,evidenceRef:null,
    policyVersion:policy?.version ?? null,reason:baselineReason ? 'no_eligible_model' : 'insufficient_evidence',baselineEligible:!baselineReason,
    calibration:baselineReason ? 'no_eligible_model' : 'uncalibrated_baseline',rejected };
  // Legacy manualModelId is ignored in every mode, including Frontier IDs.
  if (mode === 'off') return {...base,reason:baselineReason ? 'no_eligible_model' : 'routing_off'};
  if (!policy || policy.schemaVersion !== 2 || !hash(policy.datasetSha256) || !Array.isArray(policy.evidence)
    || typeof policy.version !== 'string' || !nonnegative(policy.maxLatencyMs) || !nonnegative(policy.maxCostUsdPerRequest)) return base;
  const comparators = policy.evidence.filter(e => validComparator(e,category,now));
  const baselines = comparators.filter(e => e.modelId === DEFAULT_SUMOPOD_MODEL && e.scope?.responseMode === needs.responseMode && e.scope?.role === needs.role
    && e.scope?.persona === input.mode && e.scope?.complexity === needs.complexity);
  const candidates = policy.evidence.filter(e => {
    const reason = rejection(e,input,needs,category,policy,now);
    if (!e) return false;
    const comparable = baselines.some(b => b.comparisonSet === e.comparisonSet && [...b.caseIds].sort().join('\n') === [...e.caseIds].sort().join('\n'));
    if (reason || !comparable) { if (e.category === category) rejected.push({modelId:e.modelId,reason:reason ?? 'no_comparable_baseline'}); return false; }
    return true;
  });
  candidates.sort((a,b) => b.objectivePassRate-a.objectivePassRate || b.contextPassRate-a.contextPassRate
    || b.instructionPassRate!-a.instructionPassRate! || b.qualitativeReview!.score-a.qualitativeReview!.score
    || a.p95LatencyMs-b.p95LatencyMs || a.costUsdPerRequest!-b.costUsdPerRequest! || a.modelId.localeCompare(b.modelId));
  const best = candidates[0];
  if (!best) return base;
  return {...base,modelId:mode === 'adaptive' ? best.modelId : base.modelId,recommendedModelId:best.modelId,evidenceRef:best.reportRef,
    reason:mode === 'adaptive' ? 'qualified_evidence' : baselineReason ? 'no_eligible_model' : 'shadow_recommendation',
    calibration:mode === 'adaptive' ? 'reviewed_live_evidence' : base.calibration};
}
