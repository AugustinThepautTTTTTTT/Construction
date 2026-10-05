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
  const testKey = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || "");
  return NextResponse.json(
    {
      status: databaseStatus === "unavailable" ? "degraded" : "ok",
      service: "roomwise",
      storage: databaseStatus === "connected" ? "postgresql" : "browser",
      integrations: {
        database: databaseStatus,
        openai: Boolean(process.env.OPENAI_API_KEY),
        stripe:
          testKey &&
          Boolean(
            process.env.STRIPE_WEBHOOK_SECRET &&
            process.env.STRIPE_SINGLE_PRICE_ID &&
            databaseStatus === "connected",
          ),
        stripeMode: "test",
        email: Boolean(
          process.env.SMTP_URL &&
          process.env.EMAIL_FROM &&
          databaseStatus === "connected",
        ),
      },
    },
    { status: databaseStatus === "unavailable" ? 503 : 200 },
  );
}
