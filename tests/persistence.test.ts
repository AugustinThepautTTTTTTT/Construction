import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import * as repository from "../lib/repository";
const owner = "b1d3e4fc-072f-4ea6-8f1e-3780c8f21ffd";
const other = "c8344b5f-619a-485b-9990-f11e040f63e1";
test("database persistence survives reload and prevents another owner reading a project", async () => {
  assert.equal(
    typeof repository.ProjectRepository,
    "function",
    "project persistence must exist",
  );
  const db = new PGlite();
  await db.exec(repository.SCHEMA);
  const repo = new repository.ProjectRepository({
    query: async (text, values) => db.query<Record<string, any>>(text, values),
  });
  await db.query("INSERT INTO roomwise.users(id) VALUES ($1),($2)", [
    owner,
    other,
  ]);
  const p = await repo.create(owner, {
    room: "Kitchen",
    goal: "More storage",
    budget: "5000",
    size: "12",
    location: "France",
  });
  await repo.append(owner, p.id, [
    { role: "user", content: "Keep existing tiles" },
  ]);
  assert.equal(
    (await repo.get(owner, p.id))!.messages[0].content,
    "Keep existing tiles",
  );
  assert.equal(await repo.get(other, p.id), null);
  assert.deepEqual(await repo.list(other), []);
  await db.close();
});
test("replayed webhook grants access once and cannot grant a foreign project", async () => {
  assert.equal(typeof repository.ProjectRepository, "function");
  const db = new PGlite();
  await db.exec(repository.SCHEMA);
  const repo = new repository.ProjectRepository({
    query: async (text, values) => db.query<Record<string, any>>(text, values),
  });
  await db.query("INSERT INTO roomwise.users(id) VALUES ($1),($2)", [
    owner,
    other,
  ]);
  const p = await repo.create(owner, {
    room: "Kitchen",
    goal: "More storage",
    budget: "5000",
    size: "12",
    location: "France",
  });
  assert.equal(
    await repo.grant("evt_one", {
      plan: "single",
      ownerId: other,
      projectId: p.id,
    }),
    false,
  );
  assert.equal((await repo.get(owner, p.id))!.paid, false);
  assert.equal(
    await repo.grant("evt_two", {
      plan: "single",
      ownerId: owner,
      projectId: p.id,
    }),
    true,
  );
  assert.equal(
    await repo.grant("evt_two", {
      plan: "single",
      ownerId: owner,
      projectId: p.id,
    }),
    false,
  );
  assert.equal((await repo.get(owner, p.id))!.paid, true);
  await db.close();
});
test("only one concurrent request can consume a free room preview", async () => {
  const db = new PGlite();
  await db.exec(repository.SCHEMA);
  const repo = new repository.ProjectRepository({
    query: async (text, values) => db.query<Record<string, any>>(text, values),
  });
  await db.query("INSERT INTO roomwise.users(id) VALUES ($1)", [owner]);
  const p = await repo.create(owner, {
    room: "Kitchen",
    goal: "More storage",
    budget: "5000",
    size: "12",
    location: "France",
  });
  assert.equal(
    typeof repo.claimPreview,
    "function",
    "free preview must be claimed atomically",
  );
  assert.deepEqual(
    await Promise.all([
      repo.claimPreview(owner, p.id),
      repo.claimPreview(owner, p.id),
    ]),
    [true, false],
  );
  assert.equal(await repo.claimPreview(other, p.id), false);
  await db.close();
});
