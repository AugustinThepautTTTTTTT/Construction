import test from "node:test";
import assert from "node:assert/strict";
import { assertDeploymentEnvironment, assertProductionSource, hasSuccessfulPreview } from "../lib/release-policy";

test("only prod can deploy with production credentials", () => {
  assert.doesNotThrow(() => assertDeploymentEnvironment("production", "prod"));
  for (const ref of [undefined, "dev", "main", "work"]) {
    assert.throws(() => assertDeploymentEnvironment("production", ref));
  }
  assert.doesNotThrow(() => assertDeploymentEnvironment("preview", "dev"));
  assert.doesNotThrow(() => assertDeploymentEnvironment(undefined, undefined));
});
test("production accepts dev from the same repository only", () => {
  assert.doesNotThrow(() => assertProductionSource("prod", "dev", "owner/repo", "owner/repo"));
  assert.throws(() => assertProductionSource("prod", "work", "owner/repo", "owner/repo"));
  assert.throws(() => assertProductionSource("prod", "dev", "fork/repo", "owner/repo"));
  assert.doesNotThrow(() => assertProductionSource("dev", "feature", "owner/repo", "owner/repo"));
});
test("promotion requires the latest successful Vercel status from our project and bot", () => {
  const success = { context: "Vercel", state: "success", target_url: "https://vercel.com/tests-projects-e44ed118/construction/deployment", creator: { login: "vercel[bot]" } };
  assert.equal(hasSuccessfulPreview([success]), true);
  assert.equal(hasSuccessfulPreview([]), false);
  assert.equal(hasSuccessfulPreview([{ ...success, state: "failure" }, success]), false);
  assert.equal(hasSuccessfulPreview([{ ...success, creator: { login: "someone" } }]), false);
  assert.equal(hasSuccessfulPreview([{ ...success, target_url: "https://vercel.com/other/project/deploy" }]), false);
});
