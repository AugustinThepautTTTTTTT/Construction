import { readFile } from "node:fs/promises";
import { assertProductionSource, hasSuccessfulPreview } from "../lib/release-policy";

async function main() {
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") return;
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH!, "utf8"));
  const pr = event.pull_request;
  assertProductionSource(pr.base.ref, pr.head.ref, pr.head.repo.full_name, process.env.GITHUB_REPOSITORY!);
  if (pr.base.ref !== "prod") return;
  const endpoint = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${pr.head.sha}/statuses?per_page=100`;
  // Require a successful deployment of this exact dev commit before promotion.
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(endpoint, { headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    } });
    if (!response.ok) throw new Error(`Cannot verify dev deployment (GitHub HTTP ${response.status}).`);
    if (hasSuccessfulPreview(await response.json())) {
      console.log("Exact dev commit has a successful Vercel deployment; promotion is permitted.");
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error("The dev commit has no successful Vercel deployment. Fix staging and rerun this check.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
