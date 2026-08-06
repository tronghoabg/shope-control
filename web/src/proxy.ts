import { NextRequest, NextResponse } from 'next/server'

// Chrome Web Store versions inject dashboard_bridge.js at /app/* only.
// Redirect the exact legacy URL before the document loads; unlike a Next.js
// redirect pattern, this distinction does not also match /app/ and cannot loop.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/app') {
    const url = request.nextUrl.clone()
    url.pathname = '/app/'
    return NextResponse.redirect(url, 307)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/app', '/app/'],
}
