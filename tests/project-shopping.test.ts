import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA, ProjectRepository } from "../lib/repository";
import { briefSchema } from "../lib/domain";
import { calculateEstimate, estimateSchema } from "../lib/room-artifacts";
import { runRoomTool } from "../lib/artifact-store";
import { editProjectDeliverable } from "../lib/project-edits";
import { selectMaterialProduct } from "../lib/material-research";
import { linkConstruction } from "../lib/construction-plan";
import { skillTools } from "../lib/skill-registry";
import { materialBills } from "../lib/material-bills";
import { isProductSearchRequest } from "../lib/project-intent";
const estimate = estimateSchema.parse({
  title: "Paint upper walls",
  country: "FR",
  city: "Mulhouse",
  currency: "EUR",
  measurements: {
    floorArea: null,
    wallArea: 20,
    ceilingArea: null,
    perimeter: null,
    confirmed: false,
    notes: "Subtract retained tiles",
  },
  items: [
    {
      category: "finishes",
      item: "Paint",
      specification: "Washable blue wall paint",
      basis: "wall_area",
      manualQuantity: 20,
      unit: "litre",
      coveragePerUnit: 10,
      coats: 2,
      waste: 0.1,
      priceLow: 10,
      priceHigh: 15,
    },
    {
      category: "tools",
      item: "Brush",
      specification: "For cutting in",
      basis: "manual",
      manualQuantity: 1.2,
      unit: "piece",
      coveragePerUnit: null,
      coats: 1,
      waste: 0,
      priceLow: 5,
      priceHigh: 7,
    },
  ],
  assumptions: ["Coverage provisional"],
  exclusions: ["Labour"],
});
test("surface measurements replace photo assumptions without CAD and pack/tool quantities round up once", () => {
  const first = calculateEstimate(estimate, null);
  assert.equal(first.items[0].quantity, 5);
  assert.equal(first.items[1].quantity, 2);
  assert.equal(first.provisional, true);
  const measured = calculateEstimate(
    {
      ...estimate,
      measurements: {
        ...estimate.measurements!,
        wallArea: 30,
        confirmed: true,
      },
    },
    null,
  );
  assert.equal(measured.items[0].quantity, 7);
  assert.equal(measured.provisional, false);
  assert.equal(
    calculateEstimate(
      {
        ...estimate,
        measurements: {
          ...estimate.measurements!,
          wallArea: null,
          confirmed: true,
        },
      },
      null,
    ).provisional,
    true,
  );
});
test("normal BOM/image/works requests cannot invoke search; explicit product requests can", () => {
  for (const text of [
    "Build a complete BOM with quantities",
    "Create a blue concept",
    "Prepare a construction plan",
  ])
    assert.equal(isProductSearchRequest(text), false);
  for (const text of [
    "Find washable paint under €40",
    "Compare products for the floor",
    "Recherche une perceuse",
    "Où acheter ce meuble ?",
  ])
    assert.equal(isProductSearchRequest(text), true);
  assert.equal(
    skillTools({ layout: false, products: false }).some(
      (t) => t.name === "search_material_product",
    ),
    false,
  );
});
test("bill creation spends no research budget; saved choices, quantity edits and checklists remain linked and private", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const q = { query: (s: string, v?: any[]) => db.query<any>(s, v) },
    owner = randomUUID(),
    other = randomUUID();
  await db.query(
    "INSERT INTO roomwise.users(id,email,plan) VALUES($1,'workspace@test.com','basic'),($2,'other-workspace@test.com','basic')",
    [owner, other],
  );
  const repo = new ProjectRepository(q),
    room = await repo.create(
      owner,
      briefSchema.parse({ room: "Bathroom", goal: "Paint retained walls" }),
    );
  const artifact = await runRoomTool(
    q,
    owner,
    room.id,
    "create_material_estimate",
    estimate,
  );
  assert.equal(
    (await db.query("SELECT * FROM roomwise.ai_budget")).rows.length,
    0,
  );
  const url = "https://www.example-retailer.fr/blue-paint-25l",
    source = {
      index: 0,
      title: "Blue paint 2.5L",
      price: 30,
      url,
      checkedAt: new Date().toISOString(),
      note: "Provisional coverage",
      purchaseUnit: "pot",
      quantityPerPack: 2.5,
      coveragePerUnit: null,
    };
  await db.query(
    "UPDATE roomwise.artifacts SET data=data || $1::jsonb WHERE id=$2",
    [
      JSON.stringify({
        productComparisons: {
          0: {
            index: 0,
            products: [source],
            checkedAt: new Date().toISOString(),
          },
        },
      }),
      artifact.id,
    ],
  );
  await assert.rejects(
    selectMaterialProduct(q, other, artifact.id, 0, url),
    /not found/,
  );
  await assert.rejects(
    selectMaterialProduct(
      q,
      owner,
      artifact.id,
      0,
      "https://invented.test/product",
    ),
    /saved comparison/,
  );
  await selectMaterialProduct(q, owner, artifact.id, 0, url);
  await selectMaterialProduct(q, owner, artifact.id, 0, url);
  await editProjectDeliverable(q, owner, artifact.id, {
    action: "measurements",
    measurements: { ...estimate.measurements, wallArea: 30, confirmed: true },
  });
  await editProjectDeliverable(q, owner, artifact.id, {
    action: "shopping",
    index: 0,
    checked: true,
  });
  const saved = (
    await db.query<any>(
      "SELECT id,kind,data FROM roomwise.artifacts WHERE id=$1",
      [artifact.id],
    )
  ).rows[0];
  assert.equal(saved.data.calculations.items[0].quantity, 3);
  assert.equal(saved.data.calculations.items[0].low, 90);
  assert.equal(saved.data.shoppingChecked[0], true);
  assert.equal(saved.data.quantityItems[0].unit, "litre");
  const works = await runRoomTool(
    q,
    owner,
    room.id,
    "create_construction_plan",
    {
      title: "Paint walls",
      estimateId: artifact.id,
      overview: "Refresh retained walls",
      steps: [
        {
          title: "Apply paint",
          instructions: ["Cut in then roll prepared walls."],
          materialIndexes: [0, 1],
          dependsOn: [],
          duration: "2 hours",
          dryingTime: "Follow product label",
          checks: ["Even coverage"],
          professionalRequired: false,
        },
      ],
      assumptions: [],
    },
  );
  await assert.rejects(
    editProjectDeliverable(q, other, works.id, {
      action: "step",
      index: 0,
      checked: true,
    }),
    /not found/,
  );
  await editProjectDeliverable(q, owner, works.id, {
    action: "step",
    index: 0,
    checked: true,
  });
  const work = (
    await db.query<any>("SELECT data FROM roomwise.artifacts WHERE id=$1", [
      works.id,
    ])
  ).rows[0];
  assert.equal(work.data.completedSteps[0], true);
  const linked = linkConstruction(work.data, saved);
  assert.equal(linked.steps[0].materials[0].quantity, 3);
  assert.equal(linked.steps[0].materials[0].source.url, url);
  await editProjectDeliverable(q, owner, artifact.id, {
    action: "quantity",
    index: 0,
    base: 10,
    coats: 2,
    waste: 0,
    coveragePerUnit: 10,
  });
  const adjusted = (
    await db.query<any>("SELECT data FROM roomwise.artifacts WHERE id=$1", [
      artifact.id,
    ])
  ).rows[0];
  assert.equal(adjusted.data.calculations.items[0].quantity, 1);
  await editProjectDeliverable(q, owner, artifact.id, {
    action: "measurements",
    measurements: { ...estimate.measurements, wallArea: 50, confirmed: true },
  });
  const retained = (
    await db.query<any>("SELECT data FROM roomwise.artifacts WHERE id=$1", [
      artifact.id,
    ])
  ).rows[0];
  assert.equal(retained.data.calculations.items[0].quantity, 1);
  await db.close();
});
test("French references, purchase links and confirmed search follow-ups enable research without enabling default BOM searches", () => {
  for (const text of [
    "Propose moi deux références de carrelage",
    "Peux-tu me donner des liens vers ce carrelage",
    "Je veux des produits concrets pour le sol",
  ])
    assert.equal(isProductSearchRequest(text), true, text);
  const history = [
    {
      role: "assistant" as const,
      content: "Quel matériau souhaitez-vous rechercher dans les magasins ?",
    },
  ];
  assert.equal(isProductSearchRequest("carrelage", history), true);
  assert.equal(
    isProductSearchRequest("oui", [
      {
        role: "assistant",
        content: "Voulez-vous comparer des produits de peinture ?",
      },
    ]),
    true,
  );
  assert.equal(
    isProductSearchRequest("oui", [
      { role: "assistant", content: "Voulez-vous créer un visuel ?" },
    ]),
    false,
  );
  assert.equal(
    isProductSearchRequest("Sans recherche internet, prépare le BOM"),
    false,
  );
  const tools = skillTools({ layout: false, products: true, hasBill: true });
  assert.ok(tools.some((t) => t.name === "search_material_product"));
  assert.equal(
    tools.some((t) => t.name === "create_material_estimate"),
    false,
  );
});

test("search cannot create a one-item replacement of a complete BOM; older partial comparisons never become the default bill", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const owner = randomUUID();
  await db.query(
    "INSERT INTO roomwise.users(id,email,plan) VALUES($1,'search-protect@test.com','basic')",
    [owner],
  );
  const q = { query: (s: string, v?: any[]) => db.query<any>(s, v) },
    repo = new ProjectRepository(q),
    room = await repo.create(
      owner,
      briefSchema.parse({ room: "Bathroom", goal: "Refurbish" }),
    );
  const full = await runRoomTool(
    q,
    owner,
    room.id,
    "create_material_estimate",
    estimate,
  );
  await assert.rejects(
    runRoomTool(
      q,
      owner,
      room.id,
      "create_material_estimate",
      { ...estimate, items: [estimate.items[0]] },
      { productSearch: true },
    ),
    /existing bill/,
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "SELECT count(*)::int n FROM roomwise.artifacts",
      )
    ).rows[0].n,
    1,
  );
  const original = (
    await db.query<any>(
      "SELECT id,kind,data FROM roomwise.artifacts WHERE id=$1",
      [full.id],
    )
  ).rows[0];
  const partial: any = {
    id: randomUUID(),
    kind: "estimate",
    data: {
      title: "Carrelage de sol — présélection pour comparaison à Mulhouse",
      items: [estimate.items[0]],
    },
  };
  assert.equal(materialBills([partial, original])[0].id, full.id);
  assert.equal(original.data.items.length, 2);
  await db.close();
});
