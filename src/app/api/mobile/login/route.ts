import { z } from "zod";
import { corsPreflight, errorResponse, jsonResponse, parseBody } from "@/lib/api-auth";
import { signMobileToken } from "@/lib/mobile-jwt";
import { verifyCredentials } from "@/lib/users";

export async function OPTIONS() {
  return corsPreflight();
}

const loginSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });

// POST /api/mobile/login { email, password } -> { token, user }
export async function POST(req: Request) {
  const body = await parseBody(req, loginSchema);
  if (body.error) return body.error;

  const user = await verifyCredentials(body.data.email, body.data.password);
  if (!user) return errorResponse("Invalid email or password", 401);

  return jsonResponse({ token: signMobileToken({ sub: user.id, email: user.email }), user });
}
