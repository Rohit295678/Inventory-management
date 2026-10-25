import { corsPreflight, getUserId, jsonResponse, unauthorized } from "@/lib/api-auth";
import { findPublicUser } from "@/lib/users";

export async function OPTIONS() {
  return corsPreflight();
}

// Mobile clients call this on launch to confirm the stored token still works.
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const user = await findPublicUser(userId);
  return user ? jsonResponse({ user }) : unauthorized();
}
