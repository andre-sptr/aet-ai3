import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { getModelById } from '../ai-models.ts';
import { estimateInput, type Attempt, type Rates } from './budget.ts';
import { classifyTask, type RoutingEvidence, type RoutingMode, type RoutingPolicy, type TaskCategory } from './model-router.ts';
import { calibrationSource } from './calibration-source.ts';
import { evaluateApplicationOutput, evaluationMessages, type EvaluationCase } from './evaluation-checks.ts';
import { analyzeTask } from './task-analysis.ts';
import { deriveConversationState } from './conversation-state.ts';
import { validatePricing } from './pricing.ts';
import type { ChatMode, ResponseMode } from '../../types/index.ts';

export function configuredRoutingMode(value = process.env.AET_ROUTING_MODE): RoutingMode {
  return value === 'adaptive' || value === 'shadow' ? value : 'off';
}
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const digest = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const uniqueIds = (ids: unknown, min = 1): ids is string[] => Array.isArray(ids) && ids.length >= min
  && ids.every(id=>typeof id === 'string' && /^[\w-]+$/.test(id)) && new Set(ids).size === ids.length;
type Ref = { ref: string; sha256: string };
export type RoutingEvidenceSpec = {
  modelId: string; category: TaskCategory; responseMode: ResponseMode;
  persona: ChatMode; complexity: 'simple' | 'complex';
  caseIds: string[]; contextCaseIds: string[]; report: Ref; review?: Ref;
};
type Sample = {
  sampleId: string; caseId: string; repeat: number; variant: string; persona: string;
  status: string; objectiveStatus?: string; answer: string; checks: unknown; latencyMs: number;
  metadata?: {responseOrigin?:string;requestedModel?:string;model?:string;reportedModel?:string;modelIdentity?:string};
  providerRequests?: {body:{model:string;messages:{role:string;content:string}[];max_tokens?:number;max_completion_tokens?:number};httpStatus:number|null}[];
  telemetry?: {attempts:Attempt[];toolCalls:number};
};
type ApplicationReport = {
  schemaVersion: number; kind: string; sourceKind: string; planOnly: boolean;
  checkedAt: string; finishedAt: string; pipelineSha256: string; productionPromptSha256: string;
  datasetSha256: string; budgetGuard?:{allowed?:boolean;keyBound?:boolean};
  repeats: number;
  pricing?: {operatorVerified?:boolean;sourceUrl?:string;verifiedAt?:string;models?:Rates};
  results: Sample[];
};
async function boundedBytes(file: string, maxBytes: number): Promise<Buffer> {
  if ((await stat(file)).size > maxBytes) throw new Error('File exceeds evidence bound.');
  const bytes = await readFile(file);
  if (bytes.length > maxBytes) throw new Error('File exceeds evidence bound.');
  return bytes;
}
/** References are server-controlled local artifacts; symlinks cannot escape the project. */
async function referenced(ref: Ref, cache: Map<string,Promise<Buffer>>, fixtures = false) {
  if (!ref || !digest(ref.sha256) || typeof ref.ref !== 'string' || ref.ref.includes('..')
    || !(fixtures ? /^tests\/fixtures\/[\w./-]+\.json$/ : /^(docs|evaluation)\/[\w./-]+\.json$/).test(ref.ref)) throw new Error('Invalid artifact reference.');
  const root = await realpath(process.cwd()), target = await realpath(path.resolve(ref.ref));
  if (!target.startsWith(root+path.sep)) throw new Error('Evidence reference escaped project.');
  let promise = cache.get(target);
  if (!promise) { promise = boundedBytes(target,fixtures ? 1_000_000 : 8_000_000); cache.set(target,promise); }
  const bytes = await promise;
  if (sha(bytes) !== ref.sha256) throw new Error('Artifact hash mismatch.');
  return bytes;
}
function fixtureText(c: EvaluationCase) { return c.prompt ?? c.messages?.at(-1)?.content ?? ''; }
function fixtureChars(c: EvaluationCase) {
  return c.prompt?.length ?? c.messages?.reduce((n,m)=>n+(m.content?.length ?? (m.filler ? Array.from({length:m.filler},(_,i)=>`Obrolan sampingan ${i}.`.length).reduce((a,b)=>a+b,0) : 0)),0) ?? 0;
}
function sampleCost(s: Sample, rates: Rates): number | null {
  const attempts = s.telemetry?.attempts;
  if (!attempts?.length || attempts.some(a=>!finite(a.usage?.prompt_tokens) || !finite(a.usage?.completion_tokens) || !rates[a.model])) return null;
  return attempts.reduce((n,a)=>n+(a.usage!.prompt_tokens!*rates[a.model].inputUsdPerMillion+a.usage!.completion_tokens!*rates[a.model].outputUsdPerMillion)/1e6,0);
}
async function normalize(spec: RoutingEvidenceSpec, dataset: EvaluationCase[], datasetSha256: string, source: Awaited<ReturnType<typeof calibrationSource>>, cache: Map<string,Promise<Buffer>>, now: number): Promise<RoutingEvidence> {
  if (!getModelById(spec?.modelId) || !['daily','academic','coding','reasoning'].includes(spec.category)
    || !['daily','report','coding'].includes(spec.persona) || !['simple','complex'].includes(spec.complexity)
    || !['fast','normal','think'].includes(spec.responseMode) || !uniqueIds(spec.caseIds,3) || !uniqueIds(spec.contextCaseIds)
    || spec.caseIds.some(id=>spec.contextCaseIds.includes(id))) throw new Error('Invalid scope or insufficient cases.');
  const report = JSON.parse((await referenced(spec.report,cache)).toString('utf8')) as ApplicationReport;
  const checked = Date.parse(report.checkedAt), finished = Date.parse(report.finishedAt);
  if (report.schemaVersion !== 2 || report.kind !== 'application-evaluation' || report.sourceKind !== 'live' || report.planOnly !== false
    || report.datasetSha256 !== datasetSha256 || report.pipelineSha256 !== source.pipelineSha256 || report.productionPromptSha256 !== source.productionPromptSha256
    || !Number.isFinite(checked) || finished < checked || !Number.isFinite(finished) || finished > now || now-checked > 7*86_400_000
    || report.budgetGuard?.allowed !== true || report.budgetGuard.keyBound !== true || !Array.isArray(report.results)) throw new Error('Unverified, stale, plan, mock, screening or incompatible application evidence.');
  const caseMap = new Map(dataset.map(c=>[c.id,c]));
  for (const id of spec.caseIds) {
    const c = caseMap.get(id);
    if (!c || c.category === 'context' || c.persona !== spec.persona || c.messages?.some(m=>m.attachment)) throw new Error('Case category/input mismatch.');
    const messages=evaluationMessages(c), task=analyzeTask(messages,deriveConversationState(messages),c.persona);
    if ((task.complex?'complex':'simple') !== spec.complexity || classifyTask({mode:c.persona,text:task.intentText,latestText:task.latest,
      previousTaskText:task.previousTaskText,continuesTask:task.followup,contextChars:fixtureChars(c)}) !== spec.category) throw new Error('Case category/complexity mismatch.');
  }
  if (!spec.contextCaseIds.every(id=>caseMap.get(id)?.category === 'context' && caseMap.get(id)?.persona===spec.persona
    && !caseMap.get(id)?.messages?.some(m=>m.attachment))) throw new Error('Context checks must be context fixtures of the same persona.');
  const ids = [...spec.caseIds,...spec.contextCaseIds];
  if (!Number.isInteger(report.repeats) || report.repeats<3 || report.repeats>10
    || report.results.some(s=>s.variant===spec.responseMode && ids.includes(s.caseId) && (!Number.isInteger(s.repeat) || s.repeat<1 || s.repeat>report.repeats))) throw new Error('Invalid planned repetitions.');
  const samples = report.results.filter(s=>s.variant === spec.responseMode && s.metadata?.model === spec.modelId && ids.includes(s.caseId));
  const repeats = new Set(samples.map(s=>s.repeat));
  if (repeats.size !== report.repeats || [...repeats].some(n=>!Number.isInteger(n) || n<1)
    || samples.length !== ids.length*repeats.size || new Set(samples.map(s=>s.sampleId)).size !== samples.length
    || ids.some(id=>[...repeats].some(r=>samples.filter(s=>s.caseId===id && s.repeat===r).length !== 1))) throw new Error('Incomplete or duplicated independent samples.');
  for (const s of samples) {
    const c = caseMap.get(s.caseId)!;
    if (typeof s.answer !== 'string' || !s.answer.trim() || !finite(s.latencyMs) || s.persona !== c.persona
      || s.metadata?.responseOrigin !== 'gateway' || s.metadata.requestedModel !== spec.modelId || s.metadata.reportedModel !== spec.modelId
      || s.metadata.modelIdentity !== 'reported_match' || s.telemetry?.toolCalls !== 0) throw new Error('Invalid application sample or untested tool scope.');
    const checkedOutput = evaluateApplicationOutput(c,s.answer);
    if (checkedOutput.objectiveStatus === 'REVIEW_REQUIRED' || s.objectiveStatus !== checkedOutput.objectiveStatus
      || s.status !== s.objectiveStatus || !isDeepStrictEqual(s.checks,checkedOutput.checks)) throw new Error('Objective metrics do not match raw output.');
    const attempts = s.telemetry?.attempts, requests = s.providerRequests;
    if (!attempts?.length || !requests || requests.length !== attempts.length) throw new Error('Missing raw provider requests.');
    const final = attempts.filter(a=>a.role==='answer' || a.role==='revision');
    if (final.length !== 1 || final[0].role !== 'answer' || final[0].model !== spec.modelId) throw new Error('Answer role was not isolated.');
    for (let i=0;i<attempts.length;i++) {
      const a=attempts[i], r=requests[i], cap=r?.body?.max_tokens ?? r?.body?.max_completion_tokens;
      if (a.status !== 'complete' || a.reportedModel !== a.model || !getModelById(a.model) || r.httpStatus !== 200
        || r.body.model !== a.model || cap !== a.outputLimit || !finite(cap) || !Array.isArray(r.body.messages)
        || (a.usage?.prompt_tokens!==undefined && (!finite(a.usage.prompt_tokens) || a.usage.prompt_tokens>a.inputEstimate))
        || (a.usage?.completion_tokens!==undefined && (!finite(a.usage.completion_tokens) || a.usage.completion_tokens>a.outputLimit))
        || r.body.messages.some(m=>typeof m.content !== 'string') || estimateInput(r.body.messages) !== a.inputEstimate
        || (a.role==='answer' && r.body.messages.at(-1)?.content !== fixtureText(c))) throw new Error('Provider telemetry/request mismatch.');
    }
  }
  const primary = samples.filter(s=>spec.caseIds.includes(s.caseId)), context=samples.filter(s=>spec.contextCaseIds.includes(s.caseId));
  let review: RoutingEvidence['qualitativeReview']=null, instructionPassRate: number | null=null;
  if (spec.review) {
    const value = JSON.parse((await referenced(spec.review,cache)).toString('utf8'));
    if (value.authorKind !== 'human' || value.status !== 'completed' || typeof value.reviewer !== 'string' || !value.reviewer.trim()
      || value.reportSha256 !== spec.report.sha256 || value.datasetSha256 !== datasetSha256 || value.modelId !== spec.modelId
      || !Number.isFinite(Date.parse(value.reviewedAt)) || Date.parse(value.reviewedAt)<finished || Date.parse(value.reviewedAt)>now
      || !Array.isArray(value.samples) || value.samples.length !== samples.length || new Set(value.samples.map((s:{sampleId:string})=>s.sampleId)).size !== samples.length) throw new Error('Human review provenance mismatch.');
    const scores: {quality:number;instructions:number}[]=[];
    for (const s of samples) {
      const v=value.samples.find((v:{sampleId:string})=>v.sampleId===s.sampleId);
      if (!v || ![v.quality,v.instructions].every(n=>finite(n) && n<=5)) throw new Error('Missing human review scores.');
      scores.push(v);
    }
    instructionPassRate=scores.filter(s=>s.instructions>=4).length/scores.length;
    review={status:'completed',authorKind:'human',reviewer:value.reviewer,score:scores.reduce((n,s)=>n+s.quality,0)/scores.length};
  }
  const modelIds=[...new Set(samples.flatMap(s=>s.telemetry!.attempts.map(a=>a.model)))];
  const pricing=validatePricing(report.pricing,modelIds,checked);
  const costs=pricing.allowed ? samples.map(s=>sampleCost(s,pricing.models)) : samples.map(()=>null);
  const answerAttempts=primary.map(s=>s.telemetry!.attempts.find(a=>a.role==='answer')!);
  const comparisonSet=sha(JSON.stringify({datasetSha256,pipelineSha256:report.pipelineSha256,prompt:report.productionPromptSha256,
    category:spec.category,persona:spec.persona,complexity:spec.complexity,responseMode:spec.responseMode,cases:[...spec.caseIds].sort(),context:[...spec.contextCaseIds].sort(),repeats:[...repeats].sort(),
    outputCaps:[...new Set(answerAttempts.map(a=>a.outputLimit))].sort()}));
  return {modelId:spec.modelId,category:spec.category,sourceKind:'live',reportRef:spec.report.ref,comparisonSet,
    caseIds:[...spec.caseIds],sampleCount:primary.length,independentRepeats:repeats.size,verifiedAt:report.checkedAt,provenanceValidated:true,
    objectivePassRate:primary.filter(s=>s.objectiveStatus==='PASS').length/primary.length,
    contextPassRate:context.filter(s=>s.objectiveStatus==='PASS').length/context.length,instructionPassRate,streamingSuccessRate:1,
    qualitativeReview:review,p95LatencyMs:[...samples.map(s=>s.latencyMs)].sort((a,b)=>a-b)[Math.ceil(samples.length*.95)-1],
    costUsdPerRequest:costs.every(finite) ? costs.reduce<number>((n,c)=>n+c!,0)/costs.length : null,costVerified:costs.every(finite),
    maxTestedInputChars:Math.min(...[...repeats].map(r=>Math.max(...primary.filter(s=>s.repeat===r).map(s=>fixtureChars(caseMap.get(s.caseId)!))))),
    maxTestedInputTokens:Math.min(...[...repeats].map(r=>Math.max(...primary.filter(s=>s.repeat===r).map(s=>s.telemetry!.attempts.find(a=>a.role==='answer')!.inputEstimate)))),
    maxTestedOutputTokens:Math.min(...answerAttempts.map(a=>a.outputLimit)),
    scope:{role:'answer',persona:spec.persona,complexity:spec.complexity,responseMode:spec.responseMode,documents:false,images:false,toolEvidence:false,longContext:false}};
}

type LoadResult = {policy:RoutingPolicy|undefined;rejected:{modelId:string;reason:string}[]};
/** V1 self-asserted metrics are intentionally unsupported. Screening is never calibration. */
export async function inspectRoutingPolicy(file: string | undefined, now=Date.now()): Promise<LoadResult> {
  if (!file) return {policy:undefined,rejected:[]};
  try {
    const raw=JSON.parse((await boundedBytes(file,256_000)).toString('utf8'));
    if (raw.schemaVersion !== 2 || raw.status !== 'active' || typeof raw.version !== 'string' || !raw.version.trim()
      || !/^[\w.-]{1,80}$/.test(raw.version) || !Array.isArray(raw.evidence) || raw.evidence.length>96 || !finite(raw.maxLatencyMs) || !finite(raw.maxCostUsdPerRequest)) throw new Error('invalid_policy');
    const cache=new Map<string,Promise<Buffer>>();
    const datasetBytes=await referenced(raw.dataset,cache,true), dataset=JSON.parse(datasetBytes.toString('utf8')) as EvaluationCase[];
    if (!Array.isArray(dataset) || new Set(dataset.map(c=>c.id)).size !== dataset.length) throw new Error('invalid_dataset');
    const source=await calibrationSource(), evidence:RoutingEvidence[]=[], rejected:LoadResult['rejected']=[];
    const seen=new Set<string>();
    for (const spec of raw.evidence as RoutingEvidenceSpec[]) {
      const key=JSON.stringify([spec?.modelId,spec?.category,spec?.persona,spec?.complexity,spec?.responseMode]);
      if (seen.has(key)) return {policy:undefined,rejected:[{modelId:'policy',reason:'duplicate_evidence_scope'}]};
      seen.add(key);
      try {evidence.push(await normalize(spec,dataset,raw.dataset.sha256,source,cache,now));}
      catch (error) {
        const message=error instanceof Error?error.message:'';
        const reason=/hash mismatch/i.test(message)?'artifact_hash_mismatch':/independent samples/i.test(message)?'insufficient_or_duplicate_samples'
          :/Objective metrics/i.test(message)?'objective_metrics_mismatch':/Human review|human review/i.test(message)?'review_provenance_mismatch'
          :/telemetry|raw provider/i.test(message)?'provider_metrics_mismatch':/scope|Context checks|category/i.test(message)?'untested_scope'
          :/Unverified|stale/i.test(message)?'unverified_application_evidence':'evidence_validation_failed';
        rejected.push({modelId:getModelById(spec?.modelId)?.id ?? 'unknown',reason});
      }
    }
    return {policy:{schemaVersion:2,version:raw.version,datasetSha256:raw.dataset.sha256,evidence,maxLatencyMs:raw.maxLatencyMs,maxCostUsdPerRequest:raw.maxCostUsdPerRequest,rejectedEvidence:rejected},rejected};
  } catch {return {policy:undefined,rejected:[{modelId:'policy',reason:'policy_validation_failed'}]};}
}
const policyCache=new Map<string,{expires:number;value:Promise<LoadResult>}>();
export async function loadRoutingPolicy(file = process.env.AET_ROUTING_POLICY_FILE): Promise<RoutingPolicy | undefined> {
  if (!file) return undefined;
  const key=path.resolve(file), now=Date.now();
  let cached=policyCache.get(key);
  if (!cached || cached.expires<=now) {
    if (policyCache.size>=8) policyCache.clear();
    cached={expires:now+30_000,value:inspectRoutingPolicy(key,now)}; policyCache.set(key,cached);
  }
  return (await cached.value).policy;
}
