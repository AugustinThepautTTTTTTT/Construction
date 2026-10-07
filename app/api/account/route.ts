import {stripeKeyConfigured,stripeMode} from "@/lib/stripe-mode";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/database";
import { identity, sameOrigin, error } from "@/lib/server";
export async function GET(r: NextRequest) {
  const user = await identity(r);
  const db = await database();
  if (!user?.email || !db) return error("Sign in first.", 401);
  const stats = await db.query(
    "SELECT count(*)::int AS rooms,count(*) FILTER(WHERE paid)::int AS unlocked FROM roomwise.projects WHERE user_id=$1",
    [user.id],
  );
  const billing = await db.query(
    "SELECT stripe_customer_id,subscription_id FROM roomwise.users WHERE id=$1",
    [user.id],
  );
  return NextResponse.json({
    user,
    usage: (await db.query("SELECT delta,kind,description,created_at FROM roomwise.credit_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 25",[user.id])).rows,
    stats: stats.rows[0],
    billingAvailable: Boolean(billing.rows[0]?.stripe_customer_id),
    subscription: Boolean(billing.rows[0]?.subscription_id),
    stripeMode: stripeMode(),
  });
}
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const user = await identity(r);
  const db = await database();
  if (!user?.email || !db) return error("Sign in first.", 401);
  const parsed = z
    .object({ name: z.string().trim().max(80) })
    .safeParse(await r.json().catch(() => null));
  if (!parsed.success) return error("Please shorten your name.", 400);
  await db.query("UPDATE roomwise.users SET name=$1 WHERE id=$2", [
    parsed.data.name,
    user.id,
  ]);
  return NextResponse.json({ saved: true });
}
