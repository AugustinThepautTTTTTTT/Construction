import {stripeKeyConfigured,stripeMode} from "@/lib/stripe-mode";
import {mailConfigured} from "@/lib/mail";
import {googleConfigured} from "@/lib/google-auth";
import { aiPolicy } from "@/lib/ai-budget";
import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/database";
import {
  identity,
  newSession,
  sessionCookie,
  sameOrigin,
  error,
} from "@/lib/server";
export const dynamic = "force-dynamic";
function capabilities() {
  return {
    accounts: databaseConfigured(),
    storage: databaseConfigured() ? "cloud" : "local",
    checkout: Boolean(
      databaseConfigured() &&
      stripeKeyConfigured() &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_BASIC_PRICE_ID,
    ),
    email: mailConfigured(),
    google: googleConfigured(),
    ai: Boolean(aiPolicy()),
  };
}
export async function GET(r: NextRequest) {
  try {
    return NextResponse.json({ ...capabilities(), user: await identity(r) });
  } catch {
    return error(
      "Cloud saving is temporarily unavailable. Your browser copy is safe.",
    );
  }
}
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  if (!databaseConfigured())
    return NextResponse.json({ ...capabilities(), user: null });
  try {
    const user = await identity(r);
    if (user) return NextResponse.json({ ...capabilities(), user });
    const s = await newSession();
    return sessionCookie(
      NextResponse.json({
        ...capabilities(),
        user: { id: s.id, email: null, pro_active: false },
      }),
      s.token,
    );
  } catch {
    return error(
      "Cloud saving is temporarily unavailable. You can keep a browser copy.",
    );
  }
}
