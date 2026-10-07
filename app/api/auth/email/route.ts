import { randomBytes } from "node:crypto";
import {sendMail,mailConfigured} from "@/lib/mail";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { database, rateLimit } from "@/lib/database";
import { digest, identity, sameOrigin, error } from "@/lib/server";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const parsed = z
    .object({ email: z.string().email().max(254) })
    .safeParse(await r.json().catch(() => null));
  if (!parsed.success) return error("Enter a valid email address.", 400);
  if (!mailConfigured()) return error("Email sign-in is temporarily unavailable. Sign in with your password.");
  try {
    const db = await database();
    if (!db) return error("Cloud sign-in is not available yet.");
    const user = await identity(r);
    const email = parsed.data.email.toLowerCase();
    if (!(await rateLimit(`email:${digest(email)}`, 3, 3600)))
      return error("Please wait before requesting another link.", 429);
    const ip = r.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (!(await rateLimit(`mail-ip:${digest(ip)}`, 10, 3600)))
      return error("Please wait before requesting another link.", 429);
    const token = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO roomwise.magic_links(token_hash,email,guest_id,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes')",
      [digest(token), email, user?.id || null],
    );
    const link = new URL("/api/auth/verify", process.env.NEXT_PUBLIC_APP_URL);
    link.searchParams.set("token", token);
    await sendMail(email,"Your Roomwise sign-in link",`Open your Roomwise workspace: ${link.toString()}\n\nThis link expires in 15 minutes. If you did not request it, ignore this email.`);
    return NextResponse.json({ sent: true });
  } catch {
    return error("We could not send the link. Please try again later.");
  }
}
