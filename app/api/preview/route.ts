import { NextRequest } from "next/server";
import { sameOrigin, error, identity } from "@/lib/server";
// Legacy anonymous preview endpoint is retired. All trials go through the
// account-owned project and atomic quota in /api/chat.
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  try {
    if (!(await identity(r))?.email)
      return error("Create an account or sign in to use your free test.", 401);
    return error("Open your workspace to use your account’s free test.", 410);
  } catch {
    return error("Account saving is temporarily unavailable.");
  }
}
