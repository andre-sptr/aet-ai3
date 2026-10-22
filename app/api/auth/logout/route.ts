import { NextResponse } from 'next/server';
import { sameOrigin, errorResponse } from '@/lib/http';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) { return errorResponse(error); }
}
