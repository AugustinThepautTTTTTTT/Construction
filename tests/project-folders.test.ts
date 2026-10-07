import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA, ProjectRepository } from "../lib/repository";
import { briefSchema } from "../lib/domain";
import {
  createFolder,
  assignChat,
  folderAssets,
  listFolders,
} from "../lib/project-folders";
import { nameProject } from "../lib/project-naming";
import { reserveAiCall } from "../lib/ai-budget";
import { publicAddress, imageUrl, productImage } from "../lib/product-images";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatArtifact } from "../components/chat-artifact";
test("folders collect existing assets, while assignment and aggregation reject other owners", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(SCHEMA);
  const owner = randomUUID(),
    other = randomUUID();
  await db.query("INSERT INTO roomwise.users(id,email) VALUES($1,$2),($3,$4)", [
    owner,
    "folder-owner@test.com",
    other,
    "folder-other@test.com",
  ]);
  const repo = new ProjectRepository(db as any),
    brief = briefSchema.parse({ room: "Bathroom", goal: "New finishes" }),
    a = await repo.create(owner, brief),
    b = await repo.create(owner, brief),
    foreign = await repo.create(other, brief),
    folder = await createFolder(db as any, owner, "Apartment renovation"),
    otherFolder = await createFolder(db as any, other, "Private apartment");
  assert.equal(await assignChat(db as any, owner, a.id, folder.id), true);
  assert.equal(await assignChat(db as any, owner, b.id, folder.id), true);
  assert.equal(
    await assignChat(db as any, owner, foreign.id, folder.id),
    false,
  );
  assert.equal(await assignChat(db as any, owner, a.id, otherFolder.id), false);
  for (const chat of [a, b])
    await db.query(
      "INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data,image) VALUES($1,$2,$3,'visual',$4::jsonb,$5)",
      [
        randomUUID(),
        owner,
        chat.id,
        JSON.stringify({ title: chat.title }),
        Buffer.from("PRIVATE_BYTES"),
      ],
    );
  const feed = (await folderAssets(db as any, owner, folder.id))!;
  assert.equal(feed.chats.length, 2);
  assert.equal(feed.artifacts.length, 2);
  assert.ok(
    feed.artifacts.every((a: any) =>
      [a.project_id].some(
        (id) => id === feed.chats[0].id || id === feed.chats[1].id,
      ),
    ),
  );
  assert.equal(JSON.stringify(feed).includes("PRIVATE_BYTES"), false);
  assert.equal(await folderAssets(db as any, other, folder.id), null);
  assert.equal((await listFolders(db as any, other)).length, 1);
  assert.equal(await assignChat(db as any, owner, a.id, null), true);
  assert.equal(
    (await folderAssets(db as any, owner, folder.id))?.artifacts.length,
    1,
  );
  assert.equal((await repo.get(owner, a.id))?.folderId, null);
  assert.equal(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM roomwise.artifacts",
      )
    ).rows[0].n,
    2,
  );
  await db.close();
});
test("Luna naming claims only once, waits for a user message, and preserves custom titles", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const owner = randomUUID();
  await db.query("INSERT INTO roomwise.users(id,email) VALUES($1,$2)", [
    owner,
    "title@test.com",
  ]);
  const repo = new ProjectRepository(db as any),
    chat = await repo.create(
      owner,
      briefSchema.parse({ room: "Kitchen", goal: "Refurbish" }),
    );
  let calls = 0;
  const generate = async (context: string) => {
    calls++;
    assert.ok(context.length <= 900);
    return '"Warm Kitchen Refresh"';
  };
  await nameProject(db as any, owner, chat.id, "chat", generate);
  assert.equal(calls, 0);
  await repo.append(owner, chat.id, [
    { role: "user", content: "Warm kitchen " + "x".repeat(1000) },
  ]);
  await Promise.all(
    Array.from({ length: 6 }, () =>
      nameProject(db as any, owner, chat.id, "chat", generate),
    ),
  );
  assert.equal(calls, 1);
  assert.equal((await repo.get(owner, chat.id))?.title, "Warm Kitchen Refresh");
  const folder = await createFolder(db as any, owner, "My apartment");
  await db.query(
    "UPDATE roomwise.project_folders SET title='Personal name',title_status='custom' WHERE id=$1",
    [folder.id],
  );
  assert.equal(
    await nameProject(db as any, owner, folder.id, "folder", generate),
    "Personal name",
  );
  assert.equal(calls, 1);
  const failed = await createFolder(db as any, owner, "Useful fallback");
  await nameProject(db as any, owner, failed.id, "folder", async () => {
    throw new Error("Unavailable");
  });
  await nameProject(db as any, owner, failed.id, "folder", generate);
  assert.equal(calls, 1);
  assert.equal(
    (await listFolders(db as any, owner)).find((f) => f.id === failed.id)
      ?.title,
    "Useful fallback",
  );
  assert.equal(await reserveAiCall(db as any, 5, 1), true);
  await db.close();
});
test("product previews use evidenced metadata and block private networks, credentials and non-HTTPS", () => {
  assert.equal(
    productImage(
      '<meta content="https://cdn.shop.com/p.jpg?a=1&amp;b=2" property="og:image">',
      "https://shop.com/product",
    ),
    "https://cdn.shop.com/p.jpg?a=1&b=2",
  );
  assert.equal(
    productImage(
      '<script type="application/ld+json">{"@graph":[{"@type":"Product","image":["/paint.jpg"]}]}</script>',
      "https://shop.com/product",
    ),
    "https://shop.com/paint.jpg",
  );
  assert.equal(
    productImage(
      '<meta property="og:image" content="http://localhost/private">',
      "https://shop.com/product",
    ),
    null,
  );
  for (const address of [
    "127.0.0.1",
    "10.0.1.1",
    "172.31.0.1",
    "192.168.1.3",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
  for (const url of [
    "https://localhost/x",
    "https://a.local/x",
    "https://127.0.0.1/x",
    "https://user:pass@shop.com/x",
    "javascript:alert(1)",
    "https://shop.com:8080/x",
  ])
    assert.equal(imageUrl(url, "https://shop.com"), null);
});
test("a saved product-result message renders comparison cards without repeating its BOM", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const owner = randomUUID();
  await db.query("INSERT INTO roomwise.users(id,email) VALUES($1,$2)", [
    owner,
    "compare@test.com",
  ]);
  const repo = new ProjectRepository(db as any),
    chat = await repo.create(
      owner,
      briefSchema.parse({ room: "Bedroom", goal: "Paint" }),
    ),
    id = randomUUID(),
    billId = randomUUID();
  await repo.append(owner, chat.id, [
    { role: "assistant", content: "", generationId: id, status: "running" },
  ]);
  await repo.saveReply(
    owner,
    chat.id,
    id,
    "Two paint options.",
    "complete",
    undefined,
    [billId],
    { [billId]: { type: "products", index: 0 } },
  );
  const message = (await repo.get(owner, chat.id))!.messages[0];
  assert.deepEqual(message.artifactViews, {
    [billId]: { type: "products", index: 0 },
  });
  const product = {
    index: 0,
    price: 30,
    url: "https://shop.com/product/paint",
    title: "Real paint",
    note: "Washable",
    checkedAt: new Date().toISOString(),
    purchaseUnit: "pot",
    quantityPerPack: 2.5,
    imageUrl: "https://cdn.shop.com/paint.jpg",
  };
  const artifact: any = {
    id: billId,
    kind: "estimate",
    status: "ready",
    data: {
      title: "Full bill",
      lastProductSearchIndex: 0,
      currency: "EUR",
      country: "FR",
      items: [
        {
          item: "Wall paint",
          specification: "Washable",
          basis: "manual",
          manualQuantity: 5,
          coveragePerUnit: null,
          coats: 1,
          waste: 0,
          unit: "L",
          priceLow: 8,
          priceHigh: 12,
        },
      ],
      productComparisons: {
        0: {
          products: [
            product,
            {
              ...product,
              url: "https://other.com/paint",
              title: "Alternative paint",
            },
          ],
          notice: "Verify prices",
          checkedAt: new Date().toISOString(),
        },
      },
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(ChatArtifact, {
      id: billId,
      artifact,
      view: message.artifactViews![billId],
      unlocked: true,
      onChanged: () => {},
    }),
  );
  assert.ok(html.includes("Real paint"));
  assert.ok(html.includes("Alternative paint"));
  assert.ok(html.includes("Add to BOM"));
  assert.ok(html.includes("cdn.shop.com/paint.jpg"));
  assert.equal(html.includes("Materials total"), false);
  assert.equal(html.includes("Full bill"), false);
  const legacy = renderToStaticMarkup(
    React.createElement(ChatArtifact, {
      id: billId,
      artifact,
      legacyComparison: true,
      unlocked: true,
      onChanged: () => {},
    }),
  );
  assert.ok(legacy.includes("Add to BOM"));
  assert.equal(legacy.includes("Materials total"), false);
  await db.close();
});
