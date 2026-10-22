import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError, sameOrigin } from './http.ts';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
type Claims = { v: 2; purpose: 'admin' | 'frontier'; iat: number; exp: number; id: string };
export function signingSecret(name: string): string {
  const secret = process.env[name];
  if (!secret || secret.length < 32) throw new ApiError(503, 'Secret penandatanganan server belum dikonfigurasi.', 'SERVER_CONFIG');
  return secret;
}
export function constantEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function signToken(purpose: Claims['purpose'], secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ v: 2, purpose, iat: now, exp: now + SESSION_TTL_MS, id: randomUUID() })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifyToken(token: unknown, purpose: Claims['purpose'], secret: string, now = Date.now()): boolean {
  if (typeof token !== 'string' || token.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(token)) return false;
  const [payload, signature] = token.split('.');
  if (!constantEqual(signature, createHmac('sha256', secret).update(payload).digest('base64url'))) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Claims;
    return p.v === 2 && p.purpose === purpose && typeof p.id === 'string' && Number.isSafeInteger(p.iat) && Number.isSafeInteger(p.exp) && p.iat <= now && p.exp > now && p.exp - p.iat === SESSION_TTL_MS;
  } catch { return false; }
}
export function cookieValue(request: Request, name: string): string | undefined {
  return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function isAdminToken(token: unknown): boolean {
  try { return verifyToken(token, 'admin', signingSecret('ADMIN_SESSION_SECRET')); } catch { return false; }
}
export function isAdmin(request: Request): boolean { return isAdminToken(cookieValue(request, 'admin_session')); }
export function requireAdmin(request: Request) {
  sameOrigin(request);
  if (!isAdmin(request)) throw new ApiError(401, 'Silakan login sebagai admin.', 'UNAUTHORIZED');
}
