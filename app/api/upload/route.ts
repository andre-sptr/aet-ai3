import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import { readBytes, errorResponse, ApiError } from '@/lib/http';
import { validateImage, MAX_FILE_BYTES } from '@/lib/files';
import { clientKey, limit } from '@/lib/rate-limit';
export async function POST(request: Request) {
  try {
    requireAdmin(request);
    limit(`upload:${clientKey(request)}`, 20, 60_000);
    const bytes = await readBytes(request, MAX_FILE_BYTES);
    const type = validateImage(bytes, request.headers.get('content-type') || undefined);
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new ApiError(503, 'Penyimpanan gambar belum dikonfigurasi.', 'STORAGE_CONFIG');
    const suffix = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const blob = await put(`aet/${randomUUID()}.${suffix}`, Buffer.from(bytes), { access: 'public', contentType: type, addRandomSuffix: true });
    return Response.json(blob, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
