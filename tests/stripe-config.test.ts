import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Small deployment script has no declaration file.
import { checkStripe } from "../scripts/check-stripe.mjs";
test("Stripe configuration check distinguishes wrong-account prices without leaking provider errors", async () => {
  const stripe = {
    accounts: { retrieve: async () => ({id: "acct_other"}) },
    prices: { retrieve: async () => {throw {code: "resource_missing", message: "secret key and private data"};} },
  };
  const result = await checkStripe(stripe, [{plan:"single", id:"price_missing",amount:500}]);
  assert.equal(result.account, "acct_other");
  assert.equal(result.prices[0].status, "resource_missing");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});
test("Stripe configuration check validates test amount and recurring mode", async () => {
  const result = await checkStripe({
    accounts: {retrieve: async () => ({id:"acct_expected"})},
    prices: {retrieve: async (id: string) => ({livemode:false, active:true,currency:"usd",unit_amount:id === "single" ? 500 : 5000,recurring: {interval:"month"},type:id === "single" ? "one_time" : "recurring"})},
  }, [{plan:"single",id:"single",amount:500},{plan:"pro",id:"pro",amount:5000}]);
  assert.deepEqual(result.prices.map((p: {status:string})=>p.status), ["ok","ok"]);
});
