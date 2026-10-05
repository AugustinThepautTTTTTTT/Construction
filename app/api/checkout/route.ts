import { aiPolicy } from "@/lib/ai-budget";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { ProjectRepository } from "@/lib/repository";
import { identity, sameOrigin, error } from "@/lib/server";
const schema = z.object({
  plan: z.enum(["single", "pro"]),
  projectId: z.string().uuid(),
});
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const parsed = schema.safeParse(await r.json().catch(() => null));
  if (!parsed.success)
    return error("Choose a room project and plan first.", 400);
  const key = process.env.STRIPE_SECRET_KEY;
  if (
    !key ||
    !/^(sk|rk)_test_/.test(key) ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !aiPolicy()
  )
    return error(
      "Test checkout is not available yet. Your preview remains free.",
    );
  const price =
    parsed.data.plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_SINGLE_PRICE_ID;
  if (!price) return error("This plan is not available yet.");
  try {
    const user = await identity(r);
    const db = await database();
    if (!user?.email || !db)
      return error("Sign in or create an account before checkout.", 401);
    const p = await new ProjectRepository(db).get(
      user.id,
      parsed.data.projectId,
    );
    if (!p) return error("Project not found.", 404);
    if (user.pro_active || (parsed.data.plan === "single" && p.paid))
      return error("This room is already unlocked.", 409);
    if (!(await rateLimit(`checkout:${user.id}`, 10, 3600)))
      return error("Please wait before trying checkout again.", 429);
    const stripe = new Stripe(key, { timeout: 15000, maxNetworkRetries: 0 });
    const productPrice = await stripe.prices.retrieve(price);
    if (
      productPrice.livemode ||
      productPrice.currency !== "usd" ||
      productPrice.unit_amount !== (parsed.data.plan === "pro" ? 5000 : 500) ||
      (parsed.data.plan === "pro") !== (productPrice.type === "recurring")
    )
      return error("The test price needs to be checked before checkout.");
    const customerRow = await db.query(
      "SELECT stripe_customer_id FROM roomwise.users WHERE id=$1",
      [user.id],
    );
    let customerId = customerRow.rows[0].stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { roomwise_user_id: user.id } },
        { idempotencyKey: `roomwise-customer-${user.id}` },
      );
      const savedCustomer = await db.query(
        "UPDATE roomwise.users SET stripe_customer_id=COALESCE(stripe_customer_id,$1) WHERE id=$2 RETURNING stripe_customer_id",
        [customer.id, user.id],
      );
      customerId = savedCustomer.rows[0].stripe_customer_id;
    }
    const tag = Array.from(randomBytes(8), (b) =>
      String.fromCharCode(97 + (b % 26)),
    ).join("");
    const session = await stripe.checkout.sessions.create({
      mode: parsed.data.plan === "pro" ? "subscription" : "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { ownerId: user.id, projectId: p.id, plan: parsed.data.plan },
      customer: customerId,
      ...(parsed.data.plan === "pro"
        ? {
            subscription_data: {
              metadata: { ownerId: user.id, projectId: p.id },
            },
          }
        : {}),
      success_url: `${r.nextUrl.origin}/chat?project=${p.id}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${r.nextUrl.origin}/chat?project=${p.id}&checkout=cancelled`,
      integration_identifier: `roomwise_${tag}`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return error(
      "Checkout is temporarily unavailable. Please try again later.",
    );
  }
}
