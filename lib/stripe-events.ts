import Stripe from "stripe";
export function verifyTestEvent(
  payload: string,
  signature: string,
  secret: string,
) {
  const event = Stripe.webhooks.constructEvent(payload, signature, secret);
  if (event.livemode) throw new Error("Live payments are not enabled.");
  return event;
}
