import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { PGlite } from "@electric-sql/pglite";
import {
  planSchema,
  estimateSchema,
  validatePlan,
  roomMetrics,
  calculateEstimate,
  shoppingLinks,
  type RoomPlan,
} from "../lib/room-artifacts";
import { materialWorkbook } from "../lib/material-workbook";
import { SCHEMA, ProjectRepository } from "../lib/repository";
import { briefSchema } from "../lib/domain";
import { runRoomTool } from "../lib/artifact-store";
import { reserveAiCall } from "../lib/ai-budget";
import { skillInstructions, skillTools } from "../lib/skill-registry";
import { vettedPrices, retrievedUrls } from "../lib/price-research";
import {
  roomVisualPrompt,
  IMAGE_RESERVATION_CENTS,
  ROOM_IMAGE_MODEL,
} from "../lib/room-visual";
const plan = planSchema.parse({
  title: "Kitchen",
  outline: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ],
  ceilingHeight: 2.5,
  openings: [{ kind: "door", wall: 0, offset: 1, width: 0.8, height: 2 }],
  fixtures: [{ label: "Cabinet", x: 0, y: 0, width: 0.6, depth: 1 }],
  surfaces: [
    {
      surface: "Floor",
      material: "Tile",
      condition: "worn",
      evidence: "Visible discoloration",
      recommendation: "Retain unless damaged",
      confidence: "medium",
    },
  ],
  assumptions: ["Check door height"],
  questions: [],
});
const estimate = estimateSchema.parse({
  title: "Kitchen refresh",
  country: "FR",
  city: "Mulhouse",
  currency: "EUR",
  items: [
    {
      item: "Flooring",
      specification: "Water-resistant planks",
      basis: "floor_area",
      manualQuantity: null,
      unit: "pack",
      coveragePerUnit: 2.2,
      coats: 1,
      waste: 0.1,
      priceLow: 25,
      priceHigh: 35,
    },
    {
      item: "Wall paint",
      specification: "Washable finish",
      basis: "wall_area",
      manualQuantity: null,
      unit: "litre",
      coveragePerUnit: 10,
      coats: 2,
      waste: 0.1,
      priceLow: 10,
      priceHigh: 15,
    },
  ],
  assumptions: ["Coverage is provisional; check manufacturer"],
  exclusions: ["Labour and delivery"],
});
test("floor geometry computes net surfaces and rejects crossing outlines or misplaced fixtures", () => {
  assert.deepEqual(roomMetrics(plan), {
    area: 12,
    perimeter: 14,
    wallArea: 33.4,
  });
  assert.equal(validatePlan(plan).area, 12);
  assert.throws(() =>
    validatePlan({
      ...plan,
      outline: [
        { x: 0, y: 0 },
        { x: 4, y: 3 },
        { x: 4, y: 0 },
        { x: 0, y: 3 },
      ],
    }),
  );
  assert.throws(
    () =>
      validatePlan({
        ...plan,
        fixtures: [{ label: "Outside", x: 5, y: 0, width: 1, depth: 1 }],
      }),
    /outside/,
  );
  assert.throws(
    () =>
      validatePlan({
        ...plan,
        openings: [{ kind: "door", wall: 0, offset: 3.8, width: 1, height: 2 }],
      }),
    /outside/,
  );
  const irregular = {
    ...plan,
    outline: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ],
    openings: [],
    fixtures: [],
  };
  assert.equal(validatePlan(irregular).area, 12);
  const u = {
    ...plan,
    outline: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ],
    openings: [],
    fixtures: [],
  };
  assert.equal(validatePlan(u).area, 10);
});
test("material quantities round up packs with coats and waste and never invent missing measurements", () => {
  const result = calculateEstimate(estimate, plan);
  assert.equal(result.items[0].quantity, 6);
  assert.equal(result.items[1].quantity, 8);
  assert.equal(result.low, 230);
  assert.equal(result.high, 330);
  assert.equal(result.provisional, true);
  assert.equal(
    calculateEstimate(estimate, { ...plan, confirmed: true }).provisional,
    false,
  );
  assert.throws(() => calculateEstimate(estimate, null), /missing/);
  assert.throws(
    () => calculateEstimate(estimate, { ...plan, ceilingHeight: null }),
    /missing/,
  );
  assert.match(
    shoppingLinks("FR", "Mulhouse", "Wall paint")[0].url,
    /leroymerlin/,
  );
  assert.match(shoppingLinks("DE", "Berlin", "Paint")[0].url, /hornbach/);
});
test("Excel is a readable workbook with correct quantities, formulas, source links and assumptions", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await materialWorkbook({ ...estimate, plan })) as any,
  );
  const sheet = workbook.getWorksheet("Bill of materials")!;
  assert.equal(sheet.getCell("H5").value, 6);
  assert.equal(sheet.getCell("H6").value, 8);
  assert.deepEqual(sheet.getCell("L5").value, {
    formula: "H5*J5",
    result: 150,
  });
  assert.deepEqual(sheet.getCell("L7").value, {
    formula: "SUM(L5:L6)",
    result: 230,
  });
  assert.match((sheet.getCell("N5").value as any).hyperlink, /google.com/);
  assert.equal(
    workbook.getWorksheet("Assumptions and scope")?.getCell("B1").value,
    "EUR",
  );
});
test("price research retains only retrieved local retailer URLs with matching currency and unit", () => {
  const url = "https://www.leroymerlin.fr/produits/example",
    urls = retrievedUrls([{ action: { sources: [{ url }] } }]);
  const product = {
    index: 0,
    price: 29,
    url,
    title: "Floor pack",
    currency: "EUR",
    unit: "pack",
    note: "Pack coverage matches",
  };
  assert.equal(vettedPrices({ products: [product] }, estimate, urls).length, 1);
  assert.equal(
    vettedPrices(
      { products: [{ ...product, url: "https://evil.test" }] },
      estimate,
      urls,
    ).length,
    0,
  );
  assert.equal(
    vettedPrices(
      { products: [{ ...product, currency: "USD" }] },
      estimate,
      urls,
    ).length,
    0,
  );
  assert.equal(
    vettedPrices({ products: [{ ...product, unit: "m2" }] }, estimate, urls)
      .length,
    0,
  );
  assert.equal(
    vettedPrices({ products: [product] }, estimate, new Set()).length,
    0,
  );
});
test("skills expose validated tools and the image brief locks original structural geometry", () => {
  const tools = skillTools();
  assert.equal(tools.length, 3);
  for (const tool of tools) {
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
    assert.ok((tool.parameters.required as string[]).length);
  }
  assert.match(skillInstructions(), /photograph cannot establish true scale/);
  const prompt = roomVisualPrompt({
    title: "Refresh",
    sourcePhotoId: randomUUID(),
    brief: "Lighten the existing kitchen",
    retain: ["Beam and cabinets"],
    changes: ["Repaint doors"],
  });
  assert.match(prompt, /original camera position/);
  assert.match(prompt, /all door\/window/);
  assert.match(prompt, /Beam and cabinets/);
  assert.equal(ROOM_IMAGE_MODEL, "gpt-image-2.5-sunburst");
  assert.equal(IMAGE_RESERVATION_CENTS, 50);
});
test("saved room tools preserve ownership, provisional plans and attached exportable estimates", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const q = {
      query: (s: string, v?: any[]) => db.query<Record<string, any>>(s, v),
    },
    repo = new ProjectRepository(q),
    owner = randomUUID(),
    other = randomUUID();
  await db.query(
    "INSERT INTO roomwise.users(id,email) VALUES($1,'owner@example.test'),($2,'other@example.test')",
    [owner, other],
  );
  const room = await repo.create(
    owner,
    briefSchema.parse({ room: "Kitchen", goal: "Refresh finishes" }),
  );
  await assert.rejects(
    runRoomTool(q, other, room.id, "create_room_plan", plan),
    /Room not found/,
  );
  const p = await runRoomTool(q, owner, room.id, "create_room_plan", plan);
  const e = await runRoomTool(
    q,
    owner,
    room.id,
    "create_material_estimate",
    estimate,
  );
  const result = await db.query<{ data: any }>(
    "SELECT data FROM roomwise.artifacts WHERE id=$1 AND user_id=$2",
    [e.id, owner],
  );
  assert.equal(result.rows[0].data.plan.confirmed, false);
  assert.equal(result.rows[0].data.calculations.items[0].quantity, 6);
  assert.equal(
    (
      await db.query(
        "SELECT id FROM roomwise.artifacts WHERE id=$1 AND user_id=$2",
        [p.id, other],
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    runRoomTool(q, owner, room.id, "prepare_room_visual", {
      title: "New look",
      sourcePhotoId: randomUUID(),
      brief: "Repaint kitchen cabinets",
      retain: [],
      changes: ["Paint"],
    }),
    /uploaded/,
  );
  await repo.append(owner, room.id, [
    { role: "assistant", content: "", generationId: p.id },
  ]);
  await repo.saveReply(
    owner,
    room.id,
    p.id,
    "Saved plan",
    "complete",
    undefined,
    [p.id, e.id],
  );
  assert.deepEqual((await repo.get(owner, room.id))?.messages[0].artifactIds, [
    p.id,
    e.id,
  ]);
  await db.close();
});
test("text, researched prices and images share the same atomic five-dollar cap", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const q = {
    query: (s: string, v?: any[]) => db.query<Record<string, any>>(s, v),
  };
  const results = await Promise.all(
    Array.from({ length: 12 }, () => reserveAiCall(q, 500, 50)),
  );
  assert.equal(results.filter(Boolean).length, 10);
  assert.equal(await reserveAiCall(q, 500, 5), false);
  assert.equal(await reserveAiCall(q, 500, -1), false);
  await db.close();
});

test("2D plans render as safe vector geometry with dimensions and opening legends", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server"),
    { createElement } = await import("react"),
    { FloorPlan } = await import("../components/room-artifact");
  const html = renderToStaticMarkup(
    createElement(FloorPlan, {
      plan: { ...plan, title: "<script>room</script>" },
    }),
  );
  assert.match(html, /<polygon/);
  assert.match(html, /4.00 m/);
  assert.match(html, /3.00 m/);
  assert.match(html, /12.00 m²/);
  assert.match(html, /Door/);
  assert.doesNotMatch(html, /<script/);
});
