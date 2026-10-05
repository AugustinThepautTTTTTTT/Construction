import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

const schema = z.object({ plan: z.enum(["single", "pro"]) });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Checkout is not configured." }, { status: 400 });
  const price = parsed.data.plan === "pro" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_SINGLE_PRICE_ID;
  if (!price) return NextResponse.json({ error: "This plan is not configured." }, { status: 400 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: parsed.data.plan === "pro" ? "subscription" : "payment",
    line_items: [{ price, quantity: 1 }],
    success_url: `${base}/chat?checkout=success`, cancel_url: `${base}/#pricing`,
    allow_promotion_codes: true,
  });
  return NextResponse.json({ url: session.url });
}
