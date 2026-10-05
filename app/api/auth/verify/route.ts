import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { digest, newSession, sessionCookie } from "@/lib/server";
export async function GET(r: NextRequest) {
  const token = r.nextUrl.searchParams.get("token");
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return NextResponse.redirect(new URL("/account?error=expired", r.url));
  const db = await database().catch(() => null);
  if (!db)
    return NextResponse.redirect(new URL("/account?error=unavailable", r.url));
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const links = await c.query(
      "DELETE FROM roomwise.magic_links WHERE token_hash=$1 AND expires_at>now() RETURNING *",
      [digest(token)],
    );
    const link = links.rows[0];
    if (!link) {
      await c.query("ROLLBACK");
      return NextResponse.redirect(new URL("/account?error=expired", r.url));
    }
    const u = await c.query(
      "INSERT INTO roomwise.users(id,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id",
      [randomUUID(), link.email],
    );
    const id = u.rows[0].id;
    if (link.guest_id && id !== link.guest_id) {
      const guest = await c.query(
        "SELECT email FROM roomwise.users WHERE id=$1 FOR UPDATE",
        [link.guest_id],
      );
      if (guest.rows[0] && !guest.rows[0].email) {
        await c.query(
          "UPDATE roomwise.projects SET user_id=$1 WHERE user_id=$2",
          [id, link.guest_id],
        );
        const target = await c.query(
          "SELECT subscription_id FROM roomwise.users WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!target.rows[0].subscription_id) {
          const billing = await c.query(
            "SELECT pro_active,subscription_id,billing_event_at FROM roomwise.users WHERE id=$1",
            [link.guest_id],
          );
          if (billing.rows[0].subscription_id) {
            await c.query(
              "UPDATE roomwise.users SET subscription_id=NULL,pro_active=false WHERE id=$1",
              [link.guest_id],
            );
            await c.query(
              "UPDATE roomwise.users SET pro_active=$1,subscription_id=$2,billing_event_at=$3 WHERE id=$4",
              [
                billing.rows[0].pro_active,
                billing.rows[0].subscription_id,
                billing.rows[0].billing_event_at,
                id,
              ],
            );
          }
        }
        await c.query("DELETE FROM roomwise.sessions WHERE user_id=$1", [
          link.guest_id,
        ]);
      }
    }
    await c.query("COMMIT");
    const s = await newSession(id);
    return sessionCookie(
      NextResponse.redirect(new URL("/chat", r.url)),
      s.token,
    );
  } catch {
    await c.query("ROLLBACK");
    return NextResponse.redirect(new URL("/account?error=unavailable", r.url));
  } finally {
    c.release();
  }
}
