import { NextResponse } from 'next/server';
import { constantEqual, signToken, signingSecret } from '@/lib/auth';
import { ApiError, errorResponse, readJson, sameOrigin } from '@/lib/http';
import { clientKey, limit } from '@/lib/rate-limit';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    limit(`login:${clientKey(request)}`, 5, 15 * 60_000);
    const body = await readJson(request, 4096);
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password || password.length < 8) {
      throw new ApiError(
        503,
        'Akun admin belum dikonfigurasi. Password minimal 8 karakter.',
        'SERVER_CONFIG'
      );
    }
    if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 200 || body.password.length > 512) throw new ApiError(400, 'Username dan password wajib diisi.');
    const usernameOk = constantEqual(body.username, username);
    const passwordOk = constantEqual(body.password, password);
    if (!usernameOk || !passwordOk) throw new ApiError(401, 'Username atau Password salah!', 'UNAUTHORIZED');
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', signToken('admin', signingSecret('ADMIN_SESSION_SECRET')), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 86400 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) { return errorResponse(error); }
}
