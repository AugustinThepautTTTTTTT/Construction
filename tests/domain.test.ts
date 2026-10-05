import test from "node:test";
import assert from "node:assert/strict";
// These tests catch access granted for unpaid/live/forged sessions and unbounded briefs.
import * as domain from "../lib/domain";
const session = {
  livemode: false,
  payment_status: "paid",
  metadata: {
    plan: "single",
    ownerId: "b1d3e4fc-072f-4ea6-8f1e-3780c8f21ffd",
    projectId: "38402372-4c6f-43a3-a0e7-34fdc80e3ccd",
  },
};
test("paid test checkout grants access to its identified project", () => {
  assert.equal(
    typeof domain.checkoutGrant,
    "function",
    "checkout grant validation must exist",
  );
  assert.deepEqual(domain.checkoutGrant(session), {
    plan: "single",
    ownerId: session.metadata.ownerId,
    projectId: session.metadata.projectId,
  });
});
test("unpaid, live and ownerless checkout cannot grant access", () => {
  assert.equal(typeof domain.checkoutGrant, "function");
  for (const value of [
    { ...session, payment_status: "unpaid" },
    { ...session, livemode: true },
    { ...session, metadata: { plan: "single" } },
  ])
    assert.equal(domain.checkoutGrant(value), null);
});
test("unsafe redirects fall back to the workspace", () => {
  assert.equal(typeof domain.safeNext, "function");
  assert.equal(domain.safeNext("https://evil.example"), "/chat");
  assert.equal(domain.safeNext("//evil.example"), "/chat");
  assert.equal(domain.safeNext("/chat?project=abc"), "/chat?project=abc");
});
test("preview is useful without an API key and labels its estimates", () => {
  assert.equal(typeof domain.makePreview, "function");
  const text = domain.makePreview({
    room: "Kitchen",
    goal: "More storage",
    budget: "5000",
    size: "12 m²",
    location: "France",
  });
  assert.match(text, /Kitchen/i);
  assert.match(text, /More storage/);
  assert.match(text, /5000/);
  assert.match(text, /estimate|assumption/i);
});
test("brief validation rejects empty goals and oversized input", () => {
  assert.ok(domain.briefSchema, "brief validation must exist");
  assert.equal(
    domain.briefSchema.safeParse({ room: "Kitchen", goal: "", budget: "500" })
      .success,
    false,
  );
  assert.equal(
    domain.briefSchema.safeParse({
      room: "Kitchen",
      goal: "x".repeat(2001),
      budget: "500",
    }).success,
    false,
  );
});
