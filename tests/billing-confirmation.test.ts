import test from "node:test";
import assert from "node:assert/strict";
import { ownedCheckoutGrant } from "../lib/billing-confirmation";
const owner = "11111111-1111-4111-8111-111111111111",
  project = "22222222-2222-4222-8222-222222222222";
const session = {
  livemode: false,
  status: "complete",
  payment_status: "paid",
  mode: "payment",
  currency: "usd",
  amount_total: 500,
  client_reference_id: owner,
  customer: "cus_owner",
  metadata: { ownerId: owner, projectId: project, plan: "single" },
};
test("only a server-verified paid checkout belonging to this account and room can be reconciled", () => {
  assert.deepEqual(
    ownedCheckoutGrant(session, owner, project, "cus_owner"),
    session.metadata,
  );
  for (const invalid of [
    { ...session, customer: "cus_other" },
    { ...session, client_reference_id: "other" },
    { ...session, status: "open" },
    { ...session, payment_status: "unpaid" },
    { ...session, amount_total: 1 },
    { ...session, livemode: true },
    { ...session, metadata: { ...session.metadata, projectId: owner } },
  ])
    assert.equal(
      ownedCheckoutGrant(invalid, owner, project, "cus_owner"),
      null,
    );
  assert.equal(
    ownedCheckoutGrant(session, project, project, "cus_owner"),
    null,
  );
});
