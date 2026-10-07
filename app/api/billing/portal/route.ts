import {stripeClient} from "@/lib/subscriptions";
import {stripeKeyConfigured} from "@/lib/stripe-mode";
import { NextRequest, NextResponse } from "next/server";
import { database, rateLimit } from "@/lib/database";
import { identity, sameOrigin, error } from "@/lib/server";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const db = await database();
  const user = await identity(r);
  if (!db || !user?.email) return error("Sign in first.", 401);
  const key = process.env.STRIPE_SECRET_KEY;
  const config = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (!key || !stripeKeyConfigured() || !config)
    return error("Billing management is not configured yet.");
  if (!(await rateLimit(`portal:${user.id}`, 10, 3600)))
    return error("Please wait before reopening billing.", 429);
  const row = await db.query(
    "SELECT stripe_customer_id FROM roomwise.users WHERE id=$1",
    [user.id],
  );
  const customer = row.rows[0]?.stripe_customer_id;
  if (!customer) return error("You have no purchases to manage yet.", 404);
  try {
    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer,
      configuration: config,
      return_url: `${r.nextUrl.origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return error(
      "Billing is temporarily unavailable. Your saved projects are safe.",
    );
  }
}
