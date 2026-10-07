import test from "node:test";
import assert from "node:assert/strict";
import { SITE, searchRobots, structuredData } from "../lib/seo";
import { sanitizedTrackingUrl } from "../lib/telemetry";

test("search identity uses the canonical production brand and actual prices", () => {
  assert.equal(SITE.name, "Archicova");
  assert.equal(SITE.url, "https://archicova.com");
  const data = structuredData();
  assert.equal(data[0].url, SITE.url);
  assert.deepEqual(data[2].offers.map((o: { price: number }) => o.price), [0, 5, 50]);
});
test("previews are excluded from search while production permits indexing", () => {
  assert.equal(searchRobots("preview").index, false);
  assert.equal(searchRobots("production").index, true);
});
test("telemetry strips account tokens, checkout sessions, project IDs and URL fragments", () => {
  assert.equal(sanitizedTrackingUrl("https://archicova.com/account?reset=secret#private"), "https://archicova.com/account");
  assert.equal(sanitizedTrackingUrl("https://archicova.com/chat?session_id=cs_secret&project=private"), "https://archicova.com/chat");
  assert.equal(sanitizedTrackingUrl("https://archicova.com/projects/private-id"), "https://archicova.com/projects/[id]");
  assert.equal(sanitizedTrackingUrl("invalid"), null);
});
