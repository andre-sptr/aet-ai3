import { extractDocument } from '@/lib/ai/attachments';
import { readBytes, sameOrigin, errorResponse } from '@/lib/http';
import { clientKey, limit } from '@/lib/rate-limit';
import { MAX_FILE_BYTES } from '@/lib/files';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    limit(`attachment:${clientKey(request)}`, 10, 60_000);
    const mime = request.headers.get('content-type')?.split(';')[0] || '';
    const bytes = Buffer.from(await readBytes(request, MAX_FILE_BYTES));
    return Response.json(await extractDocument(bytes, mime), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
