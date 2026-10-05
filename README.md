# Roomwise

A preview-first room planning funnel, saved-room workspace, PostgreSQL persistence, OpenAI follow-up planning, and Stripe test Checkout. Without service credentials, visitors get a free rule-based preview, browser-saved rooms and downloadable text plans.

## Run and verify

```bash
npm ci
cp .env.example .env.local
npm run dev
npm test
npm run typecheck
npm run build
```

## Activate cloud services

Use only `AugustinThepautTTTTTTT/Construction`, branch `work`. The linked Vercel Hobby project is `construction` in `tests-projects-e44ed118`. Add server secrets to Vercel environment settings and redeploy; never commit them or prefix them with `NEXT_PUBLIC_`.

1. Set `DATABASE_URL` to a PostgreSQL connection string from Render (the lawyer project's database family) or Neon via Vercel Marketplace. Prefer a pooled connection for serverless traffic. The app creates an isolated `roomwise` schema automatically under a transaction lock; `npm run db:migrate` can initialize it explicitly. It does not modify the lawyer schema. Provisioning and free-plan availability depend on the provider account.
2. Set `OPENAI_API_KEY` from https://platform.openai.com/api-keys and fund API billing at https://platform.openai.com/settings/organization/billing/overview. API billing is separate from ChatGPT. The starter preview requires no API credits. Set `OPENAI_MODEL=gpt-6-luna`, `OPENAI_BUDGET_CENTS=500`, and an ISO-8601 `OPENAI_EXPIRES_AT`. Other models and missing/expired limits are refused.
3. Add the test `STRIPE_SECRET_KEY` from the connected Stripe account. The connector cannot export it. The configured test prices are $5 USD once and $50 USD/month; Checkout validates those prices and refuses live keys. Checkout stays disabled until PostgreSQL, OpenAI and Stripe credentials are present.
4. Register `/api/stripe/webhook` in Stripe test mode and add its `STRIPE_WEBHOOK_SECRET`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Ensure Stripe can reach this endpoint through Vercel deployment protection using the deployment owner's approved configuration. A Checkout redirect does not grant access: only signed, paid, test-mode webhook events do.
5. Optional email login requires `SMTP_URL`, `EMAIL_FROM`, and an accurate HTTPS `NEXT_PUBLIC_APP_URL`. Links expire after 15 minutes. Guest rooms transfer to the signed-in account; session tokens are hashed in the database and stored in HttpOnly cookies.

## Verification and current limitations

`/api/health` performs a database ping when configured and reports each integration's configuration. A 200 response with `database: unconfigured` means the browser-only preview works, not that cloud persistence is active. A configured but unreachable database returns 503. Tests exercise PostgreSQL persistence, ownership isolation, duplicate payment events, atomic preview claims, and Stripe signature/live-mode rejection. Actual provider activation still requires real credentials and an end-to-end test payment.

The workspace supports planning conversations and text downloads. Budget guidance is an estimate, not a contractor quote. Database rate limits and output limits constrain AI use. Browser copies are device-specific. The optional legacy `backend/` and Supabase scaffolding are not used by this implementation.

## PoC AI spending limit

The shared PostgreSQL ledger reserves 5 cents before each bounded Luna request, up to $5 total (at most 100 attempts). Reservations are atomic across users and workers, survive redeploys, and are retained after ambiguous failures or timeouts. The ledger never resets automatically. Calls use standard processing, no tools/retries, at most 65 KiB input plus framing and 2,200 output tokens. The reservation exceeds documented Luna costs; it is conservative accounting, not the actual OpenAI invoice. Calls stop after the configured expiration.

This only controls Roomwise traffic through this code. It cannot restrict other uses of the same key. For account-wide protection, set $5 under OpenAI Project Settings → Limits → Edit spend limit and enable Enforce a hard limit. Provider enforcement can lag slightly. Use a dedicated restricted key for this PoC.

## Accounts and billing

`/account` supports registration and login with a 12-character minimum password, profile names, password changes, and sign-out on one or all devices. Passwords use salted asynchronous scrypt; only session-token hashes are stored. Guest rooms remain owned by the account when registering or signing in. Signed-in users can access only their own rooms. Registration is available without an email provider; addresses remain unverified until a recovery or magic-link email proves ownership. SMTP must be configured before password recovery can send messages. Recovery links expire after 15 minutes, work once, and revoke existing sessions.

Checkout requires a signed-in account. The server validates each test price and associates a Stripe customer with the account. Signed webhooks validate the paid amount, currency, mode, project owner, and customer before granting access. Subscription lifecycle events reconcile against current Stripe status. `/api/billing/portal` creates a portal session only for the signed-in user's stored customer; it never accepts a client-supplied customer ID. Set `STRIPE_PORTAL_CONFIGURATION_ID` to the configured test portal with invoice history, payment-method updates, and cancellation at the billing period end.

Cloud activation still needs a deployment that Stripe can reach. Vercel Authentication currently protects the preview; it prevents public registration and Stripe webhook delivery. Removing that protection requires the deployment owner's approval/configuration. Email recovery still requires `SMTP_URL` and `EMAIL_FROM`; account registration and password login do not.


### Purchase-led account funnel

Room Pass ($5 once) and Pro ($50/month) lead to `/purchase?plan=single|pro`. Visitors register or sign in before Stripe checkout; a project is saved without consuming the free test. The existing 30-day secure session keeps signed-in users connected. The landing header switches between Sign in and My workspace.

Planning requires a registered account. `roomwise.free_trials` records one atomic starter claim per account across projects and devices; existing registered starter users are backfilled. Failed AI calls release that claim. The legacy anonymous preview endpoint is retired. This is one per account/email, not identity verification of a physical person; email recovery/verification still requires SMTP. Decorative landing motion respects reduced-motion preferences.


### Chat-first workspace and payment recovery

The workspace opens with one prominent prompt, the Roomwise logo and chat history. Room type, dimensions and budget are gathered conversationally. An unused paid room is reused before a new chat is created. Trial limits remain enforced on the server.

`POST /api/billing/confirm` reconciles a completed test checkout directly with Stripe for the authenticated owner, checking customer, owner, project, amount, currency, mode and paid status. The browser return URL never grants access. Previously completed sessions can also be recovered by listing only that user’s stored Stripe customer. Grants are persisted and idempotent; subscriptions are checked against their current provider status. This allows checkout-return recovery while protected previews cannot receive webhooks; ongoing subscription events still need a publicly reachable webhook endpoint.

### Streamed chat and room photos

The planner streams newline-delimited status and paragraph events. Each paragraph is persisted before delivery; replies include generation IDs, model, status and token usage. A database constraint allows one running reply per room. Interrupted replies retain their delivered paragraphs; a stale generation can be retried after two minutes.

Assistant Markdown is rendered as headings, lists, tables and emphasis. Raw HTML and remote embedded images are disabled. Progress labels describe request stages, not private model reasoning. Luna remains the only allowed model, with the existing shared budget and expiry.

Photos: JPG, PNG or WebP, up to three per message, 10 MB each before browser compression, and 12 stored photos per room. The browser resizes to 1280 pixels and under 512 KB per photo; the server independently decodes, validates, normalizes and strips metadata. The whole upload is capped at 2 MB even without Content-Length. Compressed photos are kept in the existing private database and served only to their signed-in owner with no shared cache. Only up to three current or most recent photos are sent to Luna with low image detail. Original camera files and documents are not stored or accepted.
