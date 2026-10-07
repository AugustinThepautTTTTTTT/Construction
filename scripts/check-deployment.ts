import { assertDeploymentEnvironment } from "../lib/release-policy";
assertDeploymentEnvironment(process.env.VERCEL_ENV, process.env.VERCEL_GIT_COMMIT_REF);
