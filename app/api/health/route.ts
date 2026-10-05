import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "roomwise",
    integrations: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SINGLE_PRICE_ID && process.env.STRIPE_PRO_PRICE_ID),
    },
  });
}
