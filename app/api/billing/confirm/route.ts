import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { identity, sameOrigin, error } from "@/lib/server";
import { ProjectRepository } from "@/lib/repository";
import { ownedCheckoutGrant } from "@/lib/billing-confirmation";
const schema = z.object({
  projectId: z.string().uuid(),
  sessionId: z
    .string()
    .regex(/^cs_test_[A-Za-z0-9]+$/)
    .optional(),
});
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const parsed = schema.safeParse(await r.json().catch(() => null));
  if (!parsed.success) return error("Choose a valid room.", 400);
  try {
    const user = await identity(r),
      db = await database();
    if (!user?.email || !db) return error("Sign in first.", 401);
    const repo = new ProjectRepository(db),
      p = await repo.get(user.id, parsed.data.projectId);
    if (!p) return error("Room not found.", 404);
    if (p.paid || user.pro_active)
      return NextResponse.json({ confirmed: true });
    if (!(await rateLimit(`confirm:${user.id}`, 60, 3600)))
      return error("Please wait before checking again.", 429);
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !/^(sk|rk)_test_/.test(key))
      return error("Test payment verification is unavailable.");
    const account = await db.query(
      "SELECT stripe_customer_id FROM roomwise.users WHERE id=$1",
      [user.id],
    );
    const customer = account.rows[0]?.stripe_customer_id;
    if (!customer) return NextResponse.json({ confirmed: false });
    const stripe = new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 });
    // Also recover checkouts made before session_id was added to the return URL.
    const sessions = parsed.data.sessionId
      ? [await stripe.checkout.sessions.retrieve(parsed.data.sessionId)]
      : (
          await stripe.checkout.sessions.list({
            customer,
            status: "complete",
            limit: 20,
          })
        ).data;
    const session = sessions.find((s) =>
      ownedCheckoutGrant(s, user.id, p.id, customer),
    );
    if (!session) return NextResponse.json({ confirmed: false });
    const grant = ownedCheckoutGrant(session, user.id, p.id, customer)!;
    const subscription =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    let active = true;
    if (grant.plan === "pro") {
      if (!subscription) return NextResponse.json({ confirmed: false });
      const sub = await stripe.subscriptions.retrieve(subscription);
      active = ["active", "trialing"].includes(sub.status);
    }
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await new ProjectRepository(c).grant(
        `checkout:${session.id}`,
        grant,
        subscription,
        session.created,
        active,
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    const saved = await repo.get(user.id, p.id);
    const current = await identity(r);
    return NextResponse.json({
      confirmed: Boolean(saved?.paid || current?.pro_active),
    });
  } catch {
    return error(
      "Payment verification is temporarily unavailable. Please retry.",
    );
  }
}
