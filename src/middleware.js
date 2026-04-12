import { NextResponse } from 'next/server';

export function middleware(req) {
  // Only protect API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin') || '';
    const host = req.headers.get('host') || '';
    
    // Allow same-origin requests only (from your own Vercel domain)
    // This prevents external sites from burning your API credits
    if (origin && !origin.includes(host.split(':')[0])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
