import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { hashPassword, verifyPassword } from "@/lib/accounts";
import {
  identity,
  newSession,
  sessionCookie,
  sameOrigin,
  error,
} from "@/lib/server";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const body = z
    .object({
      currentPassword: z.string().max(128),
      newPassword: z.string().min(12).max(128),
    })
    .safeParse(await r.json().catch(() => null));
  if (!body.success)
    return error("Use a new password of at least 12 characters.", 400);
  const db = await database();
  const user = await identity(r);
  if (!db || !user?.email) return error("Sign in first.", 401);
  if (!(await rateLimit(`password:${user.id}`, 5, 900)))
    return error("Please wait before trying again.", 429);
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const old = await c.query(
      "SELECT password_hash FROM roomwise.users WHERE id=$1 FOR UPDATE",
      [user.id],
    );
    if (
      old.rows[0]?.password_hash
        ? !(await verifyPassword(
            body.data.currentPassword,
            old.rows[0].password_hash,
          ))
        : !user.email_verified
    ) {
      await c.query("ROLLBACK");
      return error("Your current password is incorrect.", 401);
    }
    const hashed = await hashPassword(body.data.newPassword);
    await c.query("UPDATE roomwise.users SET password_hash=$1 WHERE id=$2", [
      hashed,
      user.id,
    ]);
    await c.query("DELETE FROM roomwise.sessions WHERE user_id=$1", [user.id]);
    await c.query("DELETE FROM roomwise.password_resets WHERE user_id=$1", [
      user.id,
    ]);
    await c.query("DELETE FROM roomwise.magic_links WHERE email=$1", [
      user.email,
    ]);
    await c.query("COMMIT");
    const s = await newSession(user.id);
    return sessionCookie(NextResponse.json({ changed: true }), s.token);
  } catch {
    await c.query("ROLLBACK");
    return error("Password could not be changed.");
  } finally {
    c.release();
  }
}
