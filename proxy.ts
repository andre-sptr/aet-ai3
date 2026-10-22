import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdminToken } from './lib/auth';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const isLoggedIn = isAdminToken(request.cookies.get('admin_session')?.value);

    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};