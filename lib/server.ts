import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database } from "./database";
export const SESSION_COOKIE = "roomwise_session";
export function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function sameOrigin(request: NextRequest) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    // Next normalizes loopback URL hostnames; compare the HTTP authority instead.
    return (
      origin.host === request.headers.get("host") &&
      origin.protocol === request.nextUrl.protocol
    );
  } catch {
    return false;
  }
}
export function error(message: string, status = 503) {
  return NextResponse.json({ error: message }, { status });
}
export async function identity(request: NextRequest) {
  const db = await database();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!db || !token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await db.query(
    "SELECT u.id,u.email,u.pro_active FROM roomwise.sessions s JOIN roomwise.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [digest(token)],
  );
  return r.rows[0] || null;
}
export async function newSession(userId?: string) {
  const db = await database();
  if (!db) throw new Error("Database unavailable");
  const id = userId || randomUUID();
  if (!userId)
    await db.query("INSERT INTO roomwise.users(id) VALUES($1)", [id]);
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO roomwise.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')",
    [digest(token), id],
  );
  return { id, token };
}
export function sessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
  return response;
}
