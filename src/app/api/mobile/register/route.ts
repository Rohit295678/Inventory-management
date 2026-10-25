import { signMobileToken } from "@/lib/mobile-jwt";
import { registerRoute } from "@/lib/register-route";

export const { OPTIONS, POST } = registerRoute((user) => ({
  token: signMobileToken({ sub: user.id, email: user.email }),
}));
