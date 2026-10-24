import { validateToolCalls, type ToolCall } from './tools.ts';
function object(text: string): Record<string, unknown> {
  if (text.length > 16_000) throw new Error('Structured result too large.');
  const value = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g,''));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object.');
  return value;
}
const strings = (v: unknown, max = 8): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 1200);
export type Plan = { subgoals: string[]; tools: ToolCall[] };
export function parsePlan(text: string): Plan {
  const p = object(text);
  if (!strings(p.subgoals,2) || p.subgoals.some(s => s.length > 400)) throw new Error('Invalid subgoals.');
  return {subgoals:p.subgoals,tools:validateToolCalls(p.tools ?? [],2)};
}
export type WorkerResult = { conclusion: string; evidenceIds: string[]; assumptions: string[]; unresolved: string[] };
export function parseWorker(text: string, allowedIds: string[]): WorkerResult {
  const p = object(text);
  if (typeof p.conclusion !== 'string' || p.conclusion.length > 4000 || !strings(p.evidenceIds) || p.evidenceIds.some(id => !allowedIds.includes(id)) || !strings(p.assumptions) || !strings(p.unresolved)) throw new Error('Invalid worker result.');
  return p as WorkerResult;
}
export type Issue = { kind: 'goal' | 'format' | 'citation' | 'number' | 'evidence' | 'logic' | 'uncertainty'; detail: string };
export function parseReview(text: string): { issues: Issue[]; verdict: 'pass' | 'revise' | 'uncertain'; searchQuery?:string } {
  const p = object(text);
  if (!['pass','revise','uncertain'].includes(String(p.verdict)) || !Array.isArray(p.issues) || p.issues.length > 8
    || p.issues.some(i => !i || !['goal','format','citation','number','evidence','logic','uncertainty'].includes(i.kind) || typeof i.detail !== 'string' || i.detail.length > 600)) throw new Error('Invalid verifier result.');
  if(p.searchQuery!==undefined&&(typeof p.searchQuery!=='string'||p.searchQuery.length<3||p.searchQuery.length>400))throw new Error('Invalid follow-up search.');
  return p as {issues:Issue[];verdict:'pass'|'revise'|'uncertain';searchQuery?:string};
}
