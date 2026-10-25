import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (isAuthPage) {
    return token ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }
  return token ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
}

// /api is skipped so each route handles its own auth (cookie OR Bearer JWT).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
