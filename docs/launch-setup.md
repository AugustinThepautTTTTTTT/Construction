# Roomwise launch setup

## What is implemented

All members use `/chat`. Free grants 10 credits once per canonical email address. Basic costs $5/month and adds 30 credits after each verified paid monthly invoice; Pro costs $50/month and adds 350. Unused credits carry over. Messages cost 1 credit, concept images 2 additional credits, and requested product searches 4 additional credits. There is no customer-facing monetary credit value and no manual balance reset.

Free accounts can analyse photos and generate concepts. Material bills, construction plans, CAD and product research require Basic or Pro. Credit activity appears in Settings → Plan & billing. Failed generations refund their associated charge. Replayed payment notifications cannot add credits twice.

The former global PoC budget, app-level key-expiry gate, daily generation quotas and Room Pass purchase gates no longer govern these flows. Provider-side API key expiry still applies. Authentication and upload abuse protections remain.

## External launch requirements

1. **Public access:** Vercel currently protects the `vercel.app` domains with Vercel sign-in. Configure a public custom domain in the project, or explicitly change deployment protection in Vercel. Set `NEXT_PUBLIC_APP_URL` to the chosen canonical URL. Check the landing page and `/api/health` from a signed-out browser. The application itself must continue requiring Roomwise authentication for private projects.
2. **Google sign-in:** Create a Google OAuth web application. Add its `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as server-only Vercel environment variables. Add the exact authorized redirect URI `<NEXT_PUBLIC_APP_URL>/api/auth/google/callback`. The current preview callback is `https://construction-git-work-tests-projects-e44ed118.vercel.app/api/auth/google/callback`; production currently uses `https://construction-jet-mu.vercel.app/api/auth/google/callback`. Configure the Google consent screen for the intended audience. Redeploy after configuring these variables.
3. **Transactional email:** Add `EMAIL_FROM` using an address on a verified sending domain. Configure either `RESEND_API_KEY` or `SMTP_URL` as a server-only Vercel secret. Confirmation, password recovery, magic links and subscription confirmation share this provider. Until configured, signup still works and verification messages are queued; delivery and recovery are unavailable. A user can request a fresh confirmation from account settings after setup. Stripe confirmation delivery failures trigger webhook retry when a provider is configured.
4. **Real payments:** Billing is deliberately still in Stripe test mode. Current Basic and Pro test prices are monthly; the portal supports plan changes and cancellation at period end. Public launch requires a separate reviewed live-mode configuration and live prices/webhook. Do not replace a key alone: the application rejects live billing events and live prices. Test subscriptions never charge real money.

`/api/health` exposes integration readiness flags for database, credits, Google, email and billing without revealing credentials. A readiness flag only confirms configuration presence; perform an actual signup, email confirmation, Google login, test checkout and invoice replay before launch.

## Test-account verification

The deployed application's account tests must use its normal signup and Stripe checkout flows. Creating persistent password-hash fixtures through Vercel environment variables was blocked by automatic approval review, so no account seeding mechanism or password fixtures are included in this repository.

Once authorized browser access is available, create separate Free, Basic and Pro accounts with unique controlled email addresses. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any three-digit CVC and a valid billing postal code. A new paid member has its unused Free credits plus the first monthly grant; for example, an untouched Free account becomes 40 credits on Basic or 360 on Pro. The monthly grant itself is exactly 30 or 350.

Verify that spending updates the header and ledger, free accounts cannot generate material bills, insufficient balances show upgrade options without a reset, a repeated payment confirmation does not duplicate the grant, cancellation retains existing credits, and every plan uses the same workspace.
