import {requestConfirmation} from "@/lib/email-confirmation";
import {creditAccount} from "@/lib/credits";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import {
  AccountRepository,
  hashPassword,
  verifyPassword,
} from "@/lib/accounts";
import {
  digest,
  identity,
  newSession,
  sessionCookie,
  sameOrigin,
  error,
  requestIp,
} from "@/lib/server";
const schema = z.object({
  mode: z.enum(["signup", "login"]),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
  name: z.string().trim().max(80).default(""),
});
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const parsed = schema.safeParse(await r.json().catch(() => null));
  if (!parsed.success) return error("Enter a valid email and password.", 400);
  const { mode, email, password, name } = parsed.data;
  if (mode === "signup" && password.length < 12)
    return error("Use at least 12 characters for your password.", 400);
  const db = await database().catch(() => null);
  if (!db) return error("Account saving is temporarily unavailable.");
  if (
    !(await rateLimit(`auth-ip:${digest(requestIp(r))}`, 20, 900)) ||
    !(await rateLimit(`auth-email:${digest(email)}`, 10, 900))
  )
    return error("Too many attempts. Try again in 15 minutes.", 429);
  const current = await identity(r);
  if (mode === "signup" && current?.email)
    return error("Sign out before creating another account.", 409);
  const c = await db.connect();
  try {
    const repo = new AccountRepository(c);
    let user;
    if (mode === "login") {
      user = await repo.credentials(email);
      const matches = await verifyPassword(password, user?.password_hash);
      if (!user || !matches)
        return error("Email or password is incorrect.", 401);
    }
    const encoded = mode === "signup" ? await hashPassword(password) : null;
    await c.query("BEGIN");
    if (mode === "signup")
      user = await repo.register(email, name, encoded!, current?.id || null);
    else await repo.mergeGuest(user!.id, current?.id || null);
    if (current)
      await c.query("DELETE FROM roomwise.sessions WHERE token_hash=$1", [
        digest(r.cookies.get("roomwise_session")?.value || ""),
      ]);
    await c.query("COMMIT");
    await creditAccount(db, user!.id);
    const verificationSent = mode === "signup" ? await requestConfirmation(db,user!.id).catch(() => false) : undefined;
    const session = await newSession(user!.id);
    return sessionCookie(
      NextResponse.json({ authenticated: true, verificationSent }),
      session.token,
    );
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      return error(
        "Unable to create this account. Try signing in or recovering access.",
        409,
      );
    return error("Sign-in is temporarily unavailable. Please try again.");
  } finally {
    c.release();
  }
}
