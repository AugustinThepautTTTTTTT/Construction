import Stripe from "stripe";

// Read-only deployment check. Never print API keys, customer data or raw errors.
export async function checkStripe(stripe, prices, live = false) {
  const entries = await Promise.allSettled([
    stripe.accounts.retrieve(),
    ...prices.map(({ id }) => stripe.prices.retrieve(id)),
  ]);
  const code = (result) => result.status === "fulfilled" ? "ok" :
    ["resource_missing", "api_key_expired", "invalid_api_key"].includes(result.reason?.code)
      ? result.reason.code : "provider_error";
  return {
    account: entries[0].status === "fulfilled" ? entries[0].value.id : null,
    accountStatus: code(entries[0]),
    prices: prices.map(({ plan, amount }, i) => {
      const r = entries[i + 1];
      return { plan, status: r.status === "fulfilled"
        ? (r.value.livemode === live && r.value.active && r.value.currency === "usd" && r.value.unit_amount === amount && r.value.type === (plan === "single" ? "one_time" : "recurring") && (plan === "single" || r.value.recurring?.interval === "month") ? "ok" : "invalid_price")
        : code(r) };
    }),
  };
}
async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  const mode=process.env.STRIPE_MODE || "test";
  if (!["test","live"].includes(mode)) throw new Error("Invalid billing mode");
  if (!key || !new RegExp(`^(sk|rk)_${mode}_`).test(key)) console.log("Roomwise Stripe check: matching key not configured");
  else {
    const stripe = new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 });
    const prices = [
      { plan: "basic", id: process.env.STRIPE_BASIC_PRICE_ID, amount: 500 },
      { plan: "pro", id: process.env.STRIPE_PRO_PRICE_ID, amount: 5000 },
    ];
    if (prices.some(p => !p.id)) console.log("Roomwise Stripe check: price IDs missing");
    else console.log("Roomwise Stripe check:", JSON.stringify(await checkStripe(stripe, prices, mode === "live")));
  }
}

if (process.argv[1]?.endsWith("check-stripe.mjs")) void main();
