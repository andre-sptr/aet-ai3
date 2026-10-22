import { AET_FRONTIER_QUESTIONS } from '@/lib/ai-models';
import { createFrontierAccessToken, FRONTIER_ACCESS_TTL_MS, validateAetFrontierAnswers } from '@/lib/aet-frontier-access';
import { ApiError, readJson, sameOrigin, errorResponse } from '@/lib/http';
import { clientKey, limit } from '@/lib/rate-limit';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    limit(`frontier:${clientKey(request)}`, 5, 15 * 60_000);
    const body = await readJson(request, 4096);
    if (!validateAetFrontierAnswers(body.answers)) return Response.json({ error: 'Jawaban belum sesuai dengan data AET.', questions: AET_FRONTIER_QUESTIONS }, { status: 403 });
    if (process.env.ENABLE_FRONTIER !== 'true') throw new ApiError(503, 'Akses Frontier belum diaktifkan oleh pengelola.', 'FRONTIER_DISABLED');
    return Response.json({ token: createFrontierAccessToken(), expiresInMs: FRONTIER_ACCESS_TTL_MS }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
