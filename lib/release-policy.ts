export function assertDeploymentEnvironment(env: string | undefined, branch: string | undefined) {
  if (env === "production" && branch !== "prod") {
    throw new Error("Production deployments must originate from the prod branch.");
  }
}

export function assertProductionSource(base: string, head: string, headRepo: string, repo: string) {
  if (base === "prod" && (head !== "dev" || headRepo !== repo)) {
    throw new Error("Production pull requests must originate from this repository's dev branch.");
  }
}

export function hasSuccessfulPreview(statuses: Array<{ context?: string; state?: string; target_url?: string; creator?: { login?: string } }>) {
  // The statuses API returns newest first. An older success cannot override a new failure.
  const latest = statuses.find(s => s.context === "Vercel");
  return latest?.state === "success" && latest.creator?.login === "vercel[bot]" &&
    latest.target_url?.startsWith("https://vercel.com/tests-projects-e44ed118/construction/") === true;
}
