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
import { vettedPrices, retrievedUrls, priceResearchJsonSchema, applyProductPacks } from "../lib/price-research";
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
    (await materialWorkbook({ ...estimate, plan, priceSources: [{index: 1, price: 12, url: "https://www.leroymerlin.fr/produits/paint", title: "Paint", checkedAt: "2026-10-05", note: "Quoted provider price"}] })) as any,
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
    result: 246,
  });
  assert.equal(sheet.getCell("J6").value, 12);
  assert.equal(sheet.getCell("K6").value, 12);
  assert.equal(sheet.getCell("N5").value, "Unverified");
  assert.equal((sheet.getCell("O6").value as any).hyperlink, "https://www.leroymerlin.fr/produits/paint");
  assert.equal(
    workbook.getWorksheet("Assumptions and scope")?.getCell("B1").value,
    "EUR",
  );
});
test("provider extraction schema uses supported API formats while keeping strict local URL checks", () => {
  const schema = priceResearchJsonSchema();
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.products.items.properties.url.format, undefined);
  assert.ok(schema.properties.products.items.required.includes("sourceEvidence"));
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
    sourceEvidence: "Price: 29 EUR. Coverage: 2.2 m²",
    coveragePerUnit: 2.2,
    coverageEvidence: "Coverage: 2.2 m²",
  };
  assert.equal(vettedPrices({ products: [product] }, estimate, urls, "Price: 29 EUR. Coverage: 2.2 m²").length, 1);
  assert.equal(
    vettedPrices(
      { products: [{ ...product, url: "https://evil.test" }] },
      estimate,
      urls,
      "Price: 29 EUR. Coverage: 2.2 m²",
    ).length,
    0,
  );
  assert.equal(
    vettedPrices(
      { products: [{ ...product, currency: "USD" }] },
      estimate,
      urls,
      "Price: 29 EUR. Coverage: 2.2 m²",
    ).length,
    0,
  );
  assert.equal(
    vettedPrices({ products: [{ ...product, unit: "m2" }] }, estimate, urls, "Price: 29 EUR. Coverage: 2.2 m²")
      .length,
    0,
  );
  assert.equal(vettedPrices({ products: [product] }, estimate, new Set(), "Price: 29 EUR. Coverage: 2.2 m²").length, 0);
  assert.equal(vettedPrices({ products: [product] }, estimate, urls, "No price listed").length, 0);
  assert.equal(vettedPrices({ products: [{...product, url: "https://www.leroymerlin.fr/recherche/?q=tile"}] }, estimate, new Set(["https://www.leroymerlin.fr/recherche/?q=tile"]), "Price: 29 EUR. Coverage: 2.2 m²").length, 0);

});
test("skills expose validated tools and the image brief locks original structural geometry", () => {
  const tools = skillTools();
  assert.equal(tools.length, 5);
  assert.ok(!tools.some(t=>t.name==="create_room_plan"));
  assert.ok(tools.some(t=>t.name==="create_construction_plan"));
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
test("saved room tools preserve ownership, manual estimates and linked construction plans", async () => {
  const db = new PGlite();
  await db.exec(SCHEMA);
  const q = {
      query: (s: string, v?: any[]) => db.query<Record<string, any>>(s, v),
    },
    repo = new ProjectRepository(q),
    owner = randomUUID(),
    other = randomUUID();
  await db.query(
    "INSERT INTO roomwise.users(id,email,plan) VALUES($1,'owner@example.test','basic'),($2,'other@example.test','basic')",
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
  await assert.rejects(runRoomTool(q, owner, room.id, "create_room_plan", plan), /Unknown room skill/);
  const e = await runRoomTool(
    q,
    owner,
    room.id,
    "create_material_estimate",
    {...estimate,items:estimate.items.map(item=>({...item,manualQuantity:12}))},
  );
  const p=await runRoomTool(q,owner,room.id,"create_construction_plan",{title:"Kitchen works",estimateId:e.id,overview:"Refresh retained finishes",steps:[{title:"Lay flooring",instructions:["Prepare sound dry substrate and follow the selected floor installation guide."],materialIndexes:[0],dependsOn:[],duration:"Half a day",dryingTime:"Follow adhesive label if bonded",checks:["Level finish"],professionalRequired:false}],assumptions:["Provisional area"]});
  const result = await db.query<{ data: any }>(
    "SELECT data FROM roomwise.artifacts WHERE id=$1 AND user_id=$2",
    [e.id, owner],
  );
  assert.equal(result.rows[0].data.plan, null);
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
  assert.match(html, /≈ 4.0 m/);
  assert.match(html, /≈ 3.0 m/);
  assert.match(html, /12.00 m²/);
  assert.match(html, /Door/);
  assert.doesNotMatch(html, /<script/);
});

test("real paint pots replace provisional litre pricing without inventing published coverage", () => {
  const url = "https://www.castorama.fr/peinture-salle-de-bain/123456.html";
  const findings = "Price: 39.90 EUR. Pot: 2.5 litres.";
  const product = {index:1,price:39.9,url,title:"Bathroom paint 2.5 L",currency:"EUR",unit:"pot",note:"Washable bathroom paint",sourceEvidence:"Price: 39.90 EUR",coveragePerUnit:null,coverageEvidence:null,quantityPerPack:2.5,packEvidence:"Pot: 2.5 litres"};
  const sources = vettedPrices({products:[product]},estimate,new Set([url]),findings);
  assert.equal(sources.length,1);
  const updated = applyProductPacks(estimate,sources);
  assert.equal(vettedPrices({products:[{...product,packEvidence:"Pot: 2,5L"}]},estimate,new Set([url]),"Price: 39.90 EUR. Pot: 2,5L.").length,1);
  assert.equal(updated.items[1].unit,"pot");
  assert.equal(updated.items[1].coveragePerUnit,25);
  assert.equal(updated.items[1].priceLow,39.9);
  assert.match(sources[0].note,/provisional/);
  assert.equal(vettedPrices({products:[{...product,packEvidence:"Pot: 5 litres"}]},estimate,new Set([url]),findings).length,0);
  assert.equal(vettedPrices({products:[{...product,unit:"m2"}]},estimate,new Set([url]),findings).length,0);
  assert.ok(priceResearchJsonSchema().properties.products.items.required.includes("quantityPerPack"));
});
