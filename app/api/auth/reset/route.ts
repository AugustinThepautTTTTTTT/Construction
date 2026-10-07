import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {sendMail,mailConfigured} from "@/lib/mail";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { AccountRepository, hashPassword } from "@/lib/accounts";
import {
  clearSession,
  digest,
  sameOrigin,
  error,
  requestIp,
} from "@/lib/server";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const body = await r.json().catch(() => null);
  const db = await database();
  if (!db) return error("Account recovery is temporarily unavailable.");
  if (!(await rateLimit(`reset-ip:${digest(requestIp(r))}`, 10, 900)))
    return error("Please wait before trying again.", 429);
  if (body?.token) {
    const parsed = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: z.string().min(12).max(128),
      })
      .safeParse(body);
    if (!parsed.success)
      return error(
        "Use a valid recovery link and a password of at least 12 characters.",
        400,
      );
    const hashed = await hashPassword(parsed.data.password);
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      const ok = await new AccountRepository(c).resetPassword(
        digest(parsed.data.token),
        hashed,
      );
      if (!ok) {
        await c.query("ROLLBACK");
        return error("This recovery link has expired. Request a new one.", 400);
      }
      await c.query("COMMIT");
      return clearSession(NextResponse.json({ reset: true }));
    } catch {
      await c.query("ROLLBACK");
      return error("Recovery is temporarily unavailable.");
    } finally {
      c.release();
    }
  }
  const parsed = z
    .object({ email: z.string().trim().email().max(254) })
    .safeParse(body);
  if (!parsed.success) return error("Enter a valid email.", 400);
  if (!mailConfigured()) return error("Email recovery is temporarily unavailable.");
  const email = parsed.data.email.toLowerCase();
  if (!(await rateLimit(`reset-email:${digest(email)}`, 3, 3600)))
    return error("Please wait before requesting another link.", 429);
  const u = await db.query(
    "SELECT id FROM roomwise.users WHERE email=$1 AND password_hash IS NOT NULL",
    [email],
  );
  if (u.rows[0]) {
    const token = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO roomwise.password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",
      [digest(token), u.rows[0].id],
    );
    const url = new URL("/account", process.env.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("reset", token);
    try {
      await sendMail(email,"Reset your Archicova password",`Reset your password: ${url}\n\nExpires in 15 minutes. Ignore this message if you did not request it.`);
    } catch {
      await db.query(
        "DELETE FROM roomwise.password_resets WHERE token_hash=$1",
        [digest(token)],
      );
    }
  }
  return NextResponse.json({ sent: true });
}
