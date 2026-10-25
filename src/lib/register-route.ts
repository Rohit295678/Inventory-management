import { corsPreflight, errorResponse, jsonResponse, parseBody } from "@/lib/api-auth";
import { credentialsSchema } from "@/lib/schemas";
import { createUser, EmailTakenError, type PublicUser } from "@/lib/users";

// Shared by /api/register (web) and /api/mobile/register (mobile, which also
// wants a token). `extra` lets the caller decorate the 201 body.
export function registerRoute(extra: (user: PublicUser) => object = () => ({})) {
  return {
    OPTIONS: () => corsPreflight(),
    POST: async (req: Request) => {
      const body = await parseBody(req, credentialsSchema);
      if (body.error) return body.error;
      try {
        const user = await createUser(body.data);
        return jsonResponse({ user, ...extra(user) }, { status: 201 });
      } catch (err) {
        if (err instanceof EmailTakenError) return errorResponse(err.message, 409);
        throw err;
      }
    },
  };
}
