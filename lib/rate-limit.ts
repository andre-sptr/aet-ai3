import { createHash } from 'node:crypto';
import { ApiError } from './http.ts';
// Shared across routes in one process. Multiple replicas need a gateway limiter.
const state = globalThis as typeof globalThis & { aetLimits?: Map<string, { count: number; reset: number }> };
const buckets = state.aetLimits ??= new Map();
export function limit(key: string, max: number, windowMs: number, now = Date.now()): void {
  if (buckets.size > 10_000) for (const [id, value] of buckets) if (value.reset <= now) buckets.delete(id);
  let bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    if (buckets.size >= 20_000) throw new ApiError(429, 'Server sedang sibuk. Coba lagi nanti.', 'RATE_LIMIT');
    bucket = { count: 0, reset: now + windowMs }; buckets.set(key, bucket);
  }
  if (bucket.count >= max) throw new ApiError(429, 'Batas permintaan tercapai. Coba lagi nanti.', 'RATE_LIMIT');
  bucket.count++;
}
export function clientKey(request: Request): string {
  // Enable only if the trusted reverse proxy OVERWRITES the forwarding header.
  const address = process.env.TRUST_PROXY === 'true' ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() : undefined;
  return createHash('sha256').update(address || 'shared-untrusted-client').digest('hex').slice(0, 24);
}
