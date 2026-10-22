import { signToken, verifyToken, signingSecret, SESSION_TTL_MS } from './auth.ts';
export const FRONTIER_ACCESS_TTL_MS = SESSION_TTL_MS;
type Options = { now?: number; secret?: string };
export function validateAetFrontierAnswers(answers: unknown): boolean {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  const data = answers as Record<string, unknown>;
  const normalize = (v: unknown) => typeof v === 'string' && v.length <= 200 ? v.normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return normalize(data.aetFounded) === '1 april 2008' && ['selasa', 'hari selasa'].includes(normalize(data.aetAttributeDay)) && /^association (of )?electronics (and )?telecommunication$/.test(normalize(data.aetFullName));
}
export function getFrontierAccessSecret() { return signingSecret('AET_FRONTIER_ACCESS_SECRET'); }
export function createFrontierAccessToken(options: Options = {}) { return signToken('frontier', options.secret ?? getFrontierAccessSecret(), options.now); }
export function verifyFrontierAccessToken(token: unknown, options: Options = {}): boolean {
  try { return verifyToken(token, 'frontier', options.secret ?? getFrontierAccessSecret(), options.now); } catch { return false; }
}
