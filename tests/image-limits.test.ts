import test from "node:test";
import assert from "node:assert/strict";
import { imageLimits } from "../lib/image-limits";
test("only server-configured testing accounts receive the higher image allowance", () => {
  const env = { ROOMWISE_TESTER_EMAILS: " Tester@Example.com, second@example.com " };
  assert.deepEqual(imageLimits("tester@example.com", env), { daily: 20, perRoom: 10 });
  assert.deepEqual(imageLimits("second@example.com", env), { daily: 20, perRoom: 10 });
  assert.deepEqual(imageLimits("other@example.com", env), { daily: 4, perRoom: 2 });
  assert.deepEqual(imageLimits("tester@example.com", {}), { daily: 4, perRoom: 2 });
  assert.deepEqual(imageLimits("", env), { daily: 4, perRoom: 2 });
});
