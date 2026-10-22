import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RoutingEvidence, RoutingMode, RoutingPolicy } from './model-router.ts';

export function configuredRoutingMode(value = process.env.AET_ROUTING_MODE): RoutingMode {
  return value === 'adaptive' || value === 'shadow' ? value : 'off';
}
async function boundedJson(file: string, maxBytes: number): Promise<unknown> {
  if ((await stat(file)).size > maxBytes) throw new Error('Policy/evidence file exceeds bound.');
  return JSON.parse(await readFile(file, 'utf8'));
}
async function hasLiveEvidence(evidence: RoutingEvidence, datasetSha256: string): Promise<boolean> {
  if (!evidence || !Array.isArray(evidence.caseIds) || typeof evidence.reportRef !== 'string'
    || !/^docs\/[\w./-]+\.json$/.test(evidence.reportRef) || evidence.reportRef.includes('..')) return false;
  try {
    const report = await boundedJson(path.resolve(evidence.reportRef), 8_000_000) as {
      sourceKind?: string; planOnly?: boolean; datasetSha256?: string; results?: {
        model: string; caseId: string; attempted: boolean; reportedModel?: string; finishReason?: string;
        httpStatus?: number; objectiveStatus?: string; output?: string;
        request?: { body?: { messages?: { content?: unknown }[] } };
      }[];
    };
    if (report?.sourceKind !== 'live' || report.planOnly !== false || report.datasetSha256 !== datasetSha256 || !Array.isArray(report.results)) return false;
    const rows = report.results.filter(row => row.model === evidence.modelId && evidence.caseIds.includes(row.caseId));
    if (rows.length !== evidence.sampleCount || !evidence.caseIds.every(id => rows.some(row => row.caseId === id && row.attempted))) return false;
    const success = rows.filter(row => row.attempted && row.httpStatus === 200 && row.finishReason === 'stop' && row.reportedModel === evidence.modelId && typeof row.output === 'string' && row.output.trim());
    const objective = rows.filter(row => row.objectiveStatus === 'PASS');
    const maxInput = Math.max(0,...rows.map(row => (row.request?.body?.messages || []).reduce((n,m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0)));
    return success.length / rows.length === evidence.streamingSuccessRate && objective.length / rows.length === evidence.objectivePassRate
      && evidence.maxTestedInputChars <= maxInput;
  } catch { return false; }
}
/** Server-only operator policy. Referenced reports must contain actual live results.
 * Missing, oversized, mocked or inconsistent evidence cannot promote a model.
 */
export async function loadRoutingPolicy(file = process.env.AET_ROUTING_POLICY_FILE): Promise<RoutingPolicy | undefined> {
  if (!file) return undefined;
  try {
    const policy = await boundedJson(file, 256_000) as RoutingPolicy;
    if (!policy || policy.schemaVersion !== 1 || !Array.isArray(policy.evidence)) return undefined;
    const evidence: RoutingEvidence[] = [];
    for (const candidate of policy.evidence) if (await hasLiveEvidence(candidate, policy.datasetSha256)) evidence.push(candidate);
    return { ...policy, evidence };
  } catch { return undefined; }
}
