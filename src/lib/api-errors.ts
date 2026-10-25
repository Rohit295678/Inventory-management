import { Prisma } from "@prisma/client";
import { errorResponse } from "@/lib/api-auth";

// Map Prisma's "unique constraint failed" to a friendly 409, rethrow others.
export function conflictOr(err: unknown, message: string) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return errorResponse(message, 409);
  }
  throw err;
}

export const notFound = () => errorResponse("Not found", 404);
export const inUse = (what: string) =>
  errorResponse(`This ${what} is used on existing bills. Delete those bills first.`, 409);
