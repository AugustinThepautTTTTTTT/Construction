import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { ProjectRepository } from "@/lib/repository";
import { checkoutGrant } from "@/lib/domain";
import { verifyTestEvent } from "@/lib/stripe-events";
import { error } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(r: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return error("Webhook is not configured.");
  const signature = r.headers.get("stripe-signature");
  if (!signature) return error("Missing signature.", 400);
  let event;
  try {
    event = verifyTestEvent(await r.text(), signature, secret);
  } catch {
    return error("Invalid test webhook signature.", 400);
  }
  const db = await database().catch(() => null);
  if (!db) return error("Payment persistence is unavailable.");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const grant = checkoutGrant(event.data.object);
      if (grant) {
        const session = event.data.object as unknown as {
          subscription: string | { id: string } | null;
          customer: string | { id: string } | null;
        };
        const sub =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customer =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const account = await client.query(
          "SELECT stripe_customer_id FROM roomwise.users WHERE id=$1",
          [grant.ownerId],
        );
        if (
          !customer ||
          !account.rows[0] ||
          (account.rows[0].stripe_customer_id &&
            account.rows[0].stripe_customer_id !== customer)
        )
          throw new Error("Payment owner mismatch");
        let active = true;
        if (grant.plan === "pro") {
          if (!sub || !process.env.STRIPE_SECRET_KEY)
            throw new Error("Missing subscription configuration");
          const current = await new Stripe(process.env.STRIPE_SECRET_KEY, {
            timeout: 10000,
          }).subscriptions.retrieve(sub);
          active = ["active", "trialing"].includes(current.status);
        }
        const granted = await new ProjectRepository(client).grant(
          event.id,
          grant,
          sub,
          event.created,
          active,
        );
        if (granted)
          await client.query(
            "UPDATE roomwise.users SET stripe_customer_id=COALESCE(stripe_customer_id,$1) WHERE id=$2",
            [customer, grant.ownerId],
          );
      }
    } else if (
      [
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed",
      ].includes(event.type)
    ) {
      const object = event.data.object as unknown as Record<string, any>;
      const isSub = event.type.startsWith("customer.subscription");
      const subscription = isSub
        ? object.id
        : object.parent?.subscription_details?.subscription ||
          object.subscription;
      const id =
        typeof subscription === "string" ? subscription : subscription?.id;
      if (id) {
        const inserted = await client.query(
          "INSERT INTO roomwise.stripe_events(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
          [event.id],
        );
        if (inserted.rowCount) {
          if (!process.env.STRIPE_SECRET_KEY)
            throw new Error("Stripe key unavailable");
          const current = await new Stripe(process.env.STRIPE_SECRET_KEY, {
            timeout: 10000,
            maxNetworkRetries: 0,
          }).subscriptions.retrieve(id);
          const active = ["active", "trialing"].includes(current.status);
          await client.query(
            "UPDATE roomwise.users SET pro_active=$1,billing_event_at=$3 WHERE subscription_id=$2 AND billing_event_at<=$3",
            [active, id, event.created],
          );
        }
      }
    }
    await client.query("COMMIT");
    return NextResponse.json({ received: true });
  } catch {
    await client.query("ROLLBACK");
    return error("Payment event could not be saved.");
  } finally {
    client.release();
  }
}
