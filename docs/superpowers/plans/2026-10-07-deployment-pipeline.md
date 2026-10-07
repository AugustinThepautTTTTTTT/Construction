# Deployment pipeline implementation plan

Goal: automatically deploy dev with Preview credentials and prod with Production credentials; protect promotion through tested dev pull requests.

1. Add CI quality checks and a release policy requiring same-repository dev as the production PR source and a successful Vercel status on its exact head SHA.
2. Add a build-time production source guard before any prebuild database effects, and execute build/typecheck/tests before a deployment becomes ready.
3. Create dev and prod branches from the current tested application and commit the release controls.
4. Configure Vercel's production branch/domain mapping and GitHub branch protection through authenticated administrative settings.
5. Validate CI, deployments, public health endpoints, account migration state and protection readback. Report any administrator access blocker explicitly.

Validation: automated branch/source/status regression tests, existing application suite, Next.js build and TypeScript checks; verify Vercel environment and GitHub CI results against commit SHAs.

