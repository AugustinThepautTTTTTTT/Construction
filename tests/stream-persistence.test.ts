import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA, ProjectRepository } from "../lib/repository";
import { briefSchema } from "../lib/domain";
test("streamed paragraphs stay ordered and saved, with updates scoped to their owner and generation", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const q = {
    query: (s: string, v?: any[]) => db.query<Record<string, any>>(s, v),
  };
  const repo = new ProjectRepository(q),
    owner = randomUUID(),
    stranger = randomUUID();
  await db.query(
    "INSERT INTO roomwise.users(id,email) VALUES($1,'one@example.test'),($2,'two@example.test')",
    [owner, stranger],
  );
  const project = await repo.create(
    owner,
    briefSchema.parse({ room: "Kitchen", goal: "More storage" }),
  );
  const id = randomUUID(),
    photo = randomUUID();
  await repo.append(owner, project.id, [
    { role: "user", content: "My kitchen", photoIds: [photo] },
    {
      role: "assistant",
      content: "",
      generationId: id,
      status: "running",
      model: "gpt-6-luna",
    },
  ]);
  await repo.saveReply(
    owner,
    project.id,
    id,
    "First paragraph.\n\n",
    "running",
  );
  await repo.saveReply(stranger, project.id, id, "Unauthorized", "complete");
  assert.equal(
    (await repo.get(owner, project.id))?.messages[1].content,
    "First paragraph.\n\n",
  );
  await repo.saveReply(
    owner,
    project.id,
    id,
    "First paragraph.\n\nSecond paragraph.",
    "complete",
    { input_tokens: 25, output_tokens: 10 },
  );
  const saved = await repo.get(owner, project.id);
  assert.equal(saved?.messages.length, 2);
  assert.equal(saved?.messages[1].status, "complete");
  assert.deepEqual(saved?.messages[0].photoIds, [photo]);
  assert.equal(saved?.messages[1].usage?.output_tokens, 10);
  assert.equal(await repo.get(stranger, project.id), null);
  await db.query(
    "INSERT INTO roomwise.generations(id,project_id) VALUES($1,$2)",
    [id, project.id],
  );
  await assert.rejects(
    db.query("INSERT INTO roomwise.generations(id,project_id) VALUES($1,$2)", [
      randomUUID(),
      project.id,
    ]),
  );
  await db.close();
});
