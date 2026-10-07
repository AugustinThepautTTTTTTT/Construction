import {stripeKeyConfigured,stripeMode} from "@/lib/stripe-mode";
import { mailConfigured } from "@/lib/mail";
import { googleConfigured } from "@/lib/google-auth";
import { aiPolicy } from "@/lib/ai-budget";
import { NextResponse } from "next/server";
import { database } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET() {
  let databaseStatus = "unconfigured";
  try {
    const db = await database();
    if (db) {
      await db.query("SELECT 1");
      databaseStatus = "connected";
    }
  } catch {
    databaseStatus = "unavailable";
  }
  const testKey = stripeKeyConfigured();
  return NextResponse.json(
    {
      status: databaseStatus === "unavailable" ? "degraded" : "ok",
      service: "roomwise",
      storage: databaseStatus === "connected" ? "postgresql" : "browser",
      integrations: {
        database: databaseStatus,
        accounts: databaseStatus === "connected",
        billingPortal: Boolean(
          process.env.STRIPE_PORTAL_CONFIGURATION_ID &&
          testKey &&
          databaseStatus === "connected",
        ),
        openai: Boolean(aiPolicy()),
        stripe:
          testKey &&
          Boolean(
            process.env.STRIPE_WEBHOOK_SECRET &&
            process.env.STRIPE_BASIC_PRICE_ID && process.env.STRIPE_PRO_PRICE_ID &&
            databaseStatus === "connected",
          ),
        stripeMode: stripeMode(),
        email: mailConfigured() && databaseStatus === "connected",
        google: googleConfigured() && databaseStatus === "connected",
        credits: databaseStatus === "connected",

      },
    },
    { status: databaseStatus === "unavailable" ? 503 : 200 },
  );
}
