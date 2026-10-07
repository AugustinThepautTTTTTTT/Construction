import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import * as mod from "../lib/stripe-events";
const secret = "whsec_test_fixture";
const payload = JSON.stringify({
  id: "evt_paid",
  object: "event",
  type: "checkout.session.completed",
  livemode: false,
  data: { object: { payment_status: "paid", livemode: false, metadata: {} } },
});
test("verified test event is accepted but altered and live payloads are rejected", () => {
  assert.equal(
    typeof mod.verifyTestEvent,
    "function",
    "verified webhook handling must exist",
  );
  const stripe = new Stripe("sk_test_fixture");
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  assert.equal(mod.verifyTestEvent(payload, signature, secret).id, "evt_paid");
  assert.throws(() =>
    mod.verifyTestEvent(payload.replace("paid", "unpaid"), signature, secret),
  );
  const live = JSON.stringify({
    id: "evt_live",
    object: "event",
    type: "checkout.session.completed",
    livemode: true,
    data: { object: {} },
  });
  const liveSignature = stripe.webhooks.generateTestHeaderString({
    payload: live,
    secret,
  });
  assert.throws(() => mod.verifyTestEvent(live, liveSignature, secret));
});

// Catch accepting an event from the wrong deployment's Stripe mode.
test('live webhooks require live configuration and still verify signatures', () => {
 const old=process.env.STRIPE_MODE;process.env.STRIPE_MODE='live';
 try {
  const live=JSON.stringify({id:'evt_live',object:'event',type:'invoice.paid',livemode:true,data:{object:{}}});
  const stripe=new Stripe('sk_test_fixture');
  const signature=stripe.webhooks.generateTestHeaderString({payload:live,secret});
  assert.equal(mod.verifyTestEvent(live,signature,secret).id,'evt_live');
  assert.throws(()=>mod.verifyTestEvent(live+' ',signature,secret));
  const testSignature=stripe.webhooks.generateTestHeaderString({payload,secret});
  assert.throws(()=>mod.verifyTestEvent(payload,testSignature,secret));
 } finally {if(old===undefined)delete process.env.STRIPE_MODE;else process.env.STRIPE_MODE=old;}
});
