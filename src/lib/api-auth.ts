import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { z } from "zod";
import { authOptions } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-jwt";

// CORS: the mobile app calls from a different (or null) origin. Auth is
// per-request via cookie or Bearer token, so CORS isn't doing security work.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function corsHeaders(): Record<string, string> {
  return { ...CORS_HEADERS };
}

export function jsonResponse(body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init);
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export function errorResponse(error: string, status: number): NextResponse {
  return jsonResponse({ error }, { status });
}

export function unauthorized(): NextResponse {
  return errorResponse("Unauthorized", 401);
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Resolve the current user from EITHER a Bearer JWT (mobile) OR the NextAuth
// cookie session (web). Returns null if neither is valid.
export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const payload = verifyMobileToken(authHeader.slice(7).trim());
    if (payload) return payload.sub;
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

type ParseResult<T> = { data: T; error?: never } | { data?: never; error: NextResponse };

// Read + validate a JSON body in one go. Returns a ready-to-send 400 on failure
// so route handlers stay a flat list of early returns.
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<ParseResult<z.infer<S>>> {
  const raw = await req.json().catch(() => undefined);
  if (raw === undefined) return { error: errorResponse("Invalid JSON body", 400) };

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return { error: errorResponse(`${where}${issue.message}`, 400) };
  }
  return { data: result.data };
}

export function requireId(req: Request): string | null {
  return new URL(req.url).searchParams.get("id");
}
