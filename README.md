# Roomwise

Roomwise is a conversion-focused prototype for an AI room planner: one funnel, one lightweight project workspace, Stripe Checkout, Supabase persistence foundations, and an OpenAI planning agent.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAugustinThepautTTTTTTT%2FConstruction&env=NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,OPENAI_API_KEY,OPENAI_MODEL,STRIPE_SECRET_KEY,STRIPE_SINGLE_PRICE_ID,STRIPE_PRO_PRICE_ID,STRIPE_WEBHOOK_SECRET&envDescription=Roomwise%20API%2C%20database%2C%20and%20test-payment%20configuration&project-name=roomwise&repository-name=Construction)

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The UI works without credentials; the chat returns a setup response until `OPENAI_API_KEY` is present. Create Stripe prices for a $5 one-time Room Pass and $50/month Pro subscription, then set their IDs. Run `supabase/schema.sql` in a Supabase free-tier project.

## Deploy

### Free-tier prototype

1. Push the `work` branch to `AugustinThepautTTTTTTT/Construction` and click **Deploy with Vercel** above (or import the repository in the Vercel dashboard).
2. Select a Vercel **Hobby** project and keep the detected Next.js settings. The Next.js route handlers provide the production API, so the optional `backend/` service does not need a second host.
3. Create a Supabase free-tier project, run `supabase/schema.sql` in its SQL editor, and copy the project URL and keys into Vercel.
4. In Stripe test mode, create a $5 one-time Price and a $50/month recurring Price, then add their IDs and test secret key to Vercel.
5. Add an OpenAI API key, set `OPENAI_MODEL`, deploy, then replace `NEXT_PUBLIC_APP_URL` with the assigned `https://….vercel.app` URL and redeploy.
6. Verify `GET /api/health`, the landing page, passwordless email, AI chat, and Stripe test checkout.

The hosting and database can remain on free tiers for prototype traffic. Stripe has transaction fees when real payments start, and OpenAI API usage is metered separately; neither is an unlimited free service. Do not switch Stripe out of test mode until webhook-based entitlements are implemented.

The optional FastAPI service in `backend/` exposes `/v1/plan` and `/health` for teams that later prefer a separate Python deployment, but it is intentionally not required for the free-tier Vercel setup.

## Guardrails

Inputs are schema-limited to 24 messages and 4,000 characters per message; output is capped at 2,200 tokens; the API applies a basic per-instance rate limit and a system-level prompt-injection boundary. Production should add authenticated, durable rate limits (for example, Upstash), Stripe webhook entitlement checks, file scanning, moderation, audit logs, and spend alerts before public launch.

## Configured deployment

The `construction` Vercel project in `tests-projects-e44ed118` uses the Hobby plan, Next.js, Node 22, and `npm ci`. Deploy the `work` branch and promote its verified preview to production.

The project has `NEXT_PUBLIC_APP_URL`, `OPENAI_MODEL`, and Stripe test Price IDs configured for the $5 Room Pass and $50/month Pro plan. The connected Stripe account is test mode only. Checkout remains unavailable until a test `STRIPE_SECRET_KEY` is securely added; AI planning and account persistence also require their OpenAI and Supabase keys. A successful `/api/health` response reports which integrations are configured, rather than implying that all integrations are active.
