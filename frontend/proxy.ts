import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cookie check is cheap; role-level enforcement happens server-side too.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('medsync_token')?.value;

  const isProtected =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/doctor') ||
    pathname.startsWith('/patient') ||
    pathname.startsWith('/appointment') ||
    pathname.startsWith('/telemedicine') ||
    pathname.startsWith('/symptom-checker') ||
    pathname.startsWith('/payment');

  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/doctor/:path*',
    '/patient/:path*',
    '/appointment/:path*',
    '/telemedicine/:path*',
    '/symptom-checker/:path*',
    '/payment/:path*',
  ],
};
