# Development and production releases

| Branch | Vercel environment | URL | Data and billing |
| --- | --- | --- | --- |
| dev | Preview | https://dev.archicova.com | Development database, Stripe test mode |
| prod | Production | https://archicova.com | Production database, Stripe live mode |

Vercel's native Git integration deploys branches; GitHub Actions checks the release. No Vercel deploy token or database secret is stored in GitHub Actions.

## Daily workflow

1. Commit to dev (or merge a feature pull request into dev).
2. Wait for Quality checks and the Vercel deployment to succeed. Test dev.archicova.com.
3. Open a pull request with base prod and head dev.
4. Release policy verifies the source branch and the successful Vercel deployment of the exact dev head commit. Quality checks run tests, build and TypeScript checks on the proposed merge.
5. Merge the pull request. Vercel builds prod with Production variables and publishes archicova.com only if all build checks pass. Keep dev for subsequent work.

Do not push directly to prod. Production builds reject any other source branch, and failed builds do not replace the current live deployment.

## Required dashboard settings

These are administrative settings, not settings a workflow file can enforce. Confirm them before treating the release path as protected:

- Vercel construction: set Production Branch to prod.
- Vercel domain dev.archicova.com: assign it to Preview branch dev.
- GitHub protection rule for prod: require a pull request (zero approval minimum permits a solo owner to merge); require Quality checks and Release policy; require branches to be up to date and conversations resolved; apply rules to administrators; disable force pushes and deletions. Do not enable the read-only Lock branch option, which prevents normal promotion merges.

The source and deployment guard files belong in both branches. After these settings are enabled, dev is the only permitted promotion source. Repository administrators can still change the rule itself.

## Current production readiness

The owner account augustin.thepaut@gmail.com was migrated into the production database with Pro access and 646 credits. Production is available for owner testing. The live Stripe key, prices and webhook are configured, and the deployment check validates the live account and both prices. A real customer purchase still needs end-to-end verification. Email delivery and Google sign-in are not configured. Health configuration flags do not substitute for testing an actual AI generation or purchase.

Database credentials stay exclusively in Vercel environment variables. Database schema changes must be backward compatible across the dev test and production promotion; reverting code does not revert database migrations.

