import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA } from "../lib/repository";
import {
  hashPassword,
  verifyPassword,
  AccountRepository,
} from "../lib/accounts";
const guest = "11111111-1111-4111-8111-111111111111";
test("passwords have unique salts and incorrect or malformed hashes are rejected", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(
    await verifyPassword("correct horse battery staple", first),
    true,
  );
  assert.equal(await verifyPassword("wrong", first), false);
  assert.equal(await verifyPassword("wrong", "broken"), false);
});
test("registration preserves guest rooms, rejects duplicate accounts, and cannot claim an existing account", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const repo = new AccountRepository({
    query: (t, v) => db.query<Record<string, any>>(t, v),
  });
  await db.query("INSERT INTO roomwise.users(id) VALUES($1)", [guest]);
  await db.query(
    "INSERT INTO roomwise.projects(id,user_id,title,brief) VALUES('22222222-2222-4222-8222-222222222222',$1,'Kitchen','{}')",
    [guest],
  );
  const user = await repo.register(
    "owner@example.com",
    "Owner",
    "encoded-password",
    guest,
  );
  assert.equal(user.id, guest);
  assert.equal(
    (
      await db.query<{ user_id: string }>(
        "SELECT user_id FROM roomwise.projects",
      )
    ).rows[0].user_id,
    guest,
  );
  await assert.rejects(() =>
    repo.register("owner@example.com", "Other", "other-hash", null),
  );
  assert.equal(
    (await repo.credentials("owner@example.com"))?.password_hash,
    "encoded-password",
  );
  await db.close();
});
test("login merges only a guest workspace, leaving other registered users rooms private", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const repo = new AccountRepository({
    query: (t, v) => db.query<Record<string, any>>(t, v),
  });
  const owner = await repo.register("one@example.com", "One", "hash", null);
  const other = await repo.register("two@example.com", "Two", "hash", null);
  await db.query("INSERT INTO roomwise.users(id) VALUES($1)", [guest]);
  await db.query(
    "INSERT INTO roomwise.projects(id,user_id,title,brief) VALUES('22222222-2222-4222-8222-222222222222',$1,'Kitchen','{}')",
    [guest],
  );
  await repo.mergeGuest(owner.id, guest);
  assert.equal(
    (
      await db.query<{ user_id: string }>(
        "SELECT user_id FROM roomwise.projects",
      )
    ).rows[0].user_id,
    owner.id,
  );
  await repo.mergeGuest(other.id, owner.id);
  assert.equal(
    (
      await db.query<{ user_id: string }>(
        "SELECT user_id FROM roomwise.projects",
      )
    ).rows[0].user_id,
    owner.id,
  );
  await db.close();
});

test("password recovery is single-use, rejects expired tokens, and revokes prior sessions", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const repo = new AccountRepository({
    query: (t, v) => db.query<Record<string, any>>(t, v),
  });
  const user = await repo.register(
    "recover@example.com",
    "Owner",
    "old-hash",
    null,
  );
  await db.query(
    "INSERT INTO roomwise.sessions(token_hash,user_id,expires_at) VALUES('session',$1,now()+interval '1 day')",
    [user.id],
  );
  await db.query(
    "INSERT INTO roomwise.password_resets(token_hash,user_id,expires_at) VALUES('expired',$1,now()-interval '1 minute'),('valid',$1,now()+interval '15 minutes')",
    [user.id],
  );
  assert.equal(await repo.resetPassword("expired", "new-hash"), false);
  assert.equal(await repo.resetPassword("valid", "new-hash"), true);
  assert.equal(await repo.resetPassword("valid", "other-hash"), false);
  assert.equal(
    (await repo.credentials("recover@example.com"))?.password_hash,
    "new-hash",
  );
  assert.equal(
    (await db.query("SELECT * FROM roomwise.sessions")).rows.length,
    0,
  );
  await db.close();
});
