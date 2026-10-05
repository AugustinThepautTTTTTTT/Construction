import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import {
  clearSession,
  digest,
  identity,
  sameOrigin,
  error,
  SESSION_COOKIE,
} from "@/lib/server";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const db = await database();
  const user = await identity(r);
  const body = await r.json().catch(() => ({}));
  if (db && user) {
    if (body.all === true)
      await db.query("DELETE FROM roomwise.sessions WHERE user_id=$1", [
        user.id,
      ]);
    else
      await db.query("DELETE FROM roomwise.sessions WHERE token_hash=$1", [
        digest(r.cookies.get(SESSION_COOKIE)?.value || ""),
      ]);
  }
  return clearSession(NextResponse.json({ signedOut: true }));
}
