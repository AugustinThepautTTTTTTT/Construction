import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA } from "../lib/repository";
import { reserveAiCall, aiPolicy, boundedInput } from "../lib/ai-budget";

test("the shared PoC budget cannot be overspent by concurrent calls or a new worker", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const q = {
    query: (text: string, values?: any[]) =>
      db.query<Record<string, any>>(text, values),
  };
  const results = await Promise.all(
    Array.from({ length: 104 }, () => reserveAiCall(q, 500)),
  );
  assert.equal(results.filter(Boolean).length, 100);
  assert.equal(await reserveAiCall(q, 500), false);
  const saved = await db.query<{ reserved_cents: number }>(
    "SELECT reserved_cents FROM roomwise.ai_budget",
  );
  assert.equal(saved.rows[0].reserved_cents, 500);
  await db.close();
});
test("only Luna is allowed, the budget cannot be raised above five dollars, and expiry is required", () => {
  const valid = {
    OPENAI_API_KEY: "test-only",
    OPENAI_MODEL: "gpt-6-luna",
    OPENAI_BUDGET_CENTS: "900",
    OPENAI_EXPIRES_AT: "2026-10-12T12:55:39Z",
  };
  assert.equal(
    aiPolicy(valid, Date.parse("2026-10-05T13:00:00Z"))?.limitCents,
    500,
  );
  assert.equal(
    aiPolicy(
      { ...valid, OPENAI_MODEL: "gpt-5.1" },
      Date.parse("2026-10-05T13:00:00Z"),
    ),
    null,
  );
  assert.equal(aiPolicy(valid, Date.parse("2026-10-13T00:00:00Z")), null);
  assert.equal(aiPolicy({ ...valid, OPENAI_EXPIRES_AT: "" }), null);
  assert.equal(aiPolicy({ ...valid, OPENAI_BUDGET_CENTS: "NaN" }), null);
});
test("oversized saved history is trimmed but an oversized new message never reaches the API", () => {
  const history = Array.from({ length: 22 }, () => ({
    role: "assistant" as const,
    content: "a".repeat(10000),
  }));
  const result = boundedInput("planner instructions", history, "more storage");
  assert.ok(result.length < 23);
  assert.equal(result.at(-1)?.content, "more storage");
  assert.throws(() => boundedInput("instructions", [], "a".repeat(70000)));
});
