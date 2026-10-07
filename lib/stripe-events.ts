import Stripe from "stripe";
import {stripeLive} from "./stripe-mode";
export function verifyTestEvent(
  payload: string,
  signature: string,
  secret: string,
) {
  const event = Stripe.webhooks.constructEvent(payload, signature, secret);
  if (event.livemode !== stripeLive()) throw new Error("Payment mode mismatch.");
  return event;
}
