export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Objek JSON tidak valid.');
  return value as Record<string, unknown>;
}
export async function readBytes(request: Request, limit: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > limit) throw new ApiError(413, 'Ukuran unggahan atau pesan terlalu besar.');
  if (!request.body) throw new ApiError(400, 'Body permintaan kosong.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new ApiError(413, 'Ukuran unggahan atau pesan terlalu besar.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export async function readJson(request: Request, limit = 256 * 1024): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'Gunakan Content-Type application/json.');
  const bytes = await readBytes(request, limit);
  try { return object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'Format JSON tidak valid.'); }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN) throw new ApiError(503, 'Origin aplikasi belum dikonfigurasi.', 'ORIGIN_CONFIG');
  const expectedOrigin = new URL(process.env.APP_ORIGIN || request.url).origin;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expectedOrigin)) throw new ApiError(403, 'Permintaan lintas situs tidak diizinkan.', 'ORIGIN_DENIED');
}
export function errorResponse(error: unknown): Response {
  const databaseCode = (error as { code?: string })?.code;
  const known = error instanceof ApiError ? error : databaseCode === 'P2002' ? new ApiError(409, 'Slug sudah digunakan.') : databaseCode === 'P2025' ? new ApiError(404, 'Data tidak ditemukan.') : new ApiError(500, 'Permintaan gagal diproses. Silakan coba lagi.', 'INTERNAL_ERROR');
  const retryAfter=(error as {retryAfter?:string})?.retryAfter;
  return Response.json({ error: known.message, code: known.code }, { status: known.status, headers: { 'Cache-Control': 'no-store', ...(typeof retryAfter==='string'&&/^\d{1,6}$/.test(retryAfter)?{'Retry-After':retryAfter}:known.status === 429 ? { 'Retry-After': '60' } : {}) } });
}
