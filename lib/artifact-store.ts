import {requirePaid} from "./credits";
import { cadUpdateSchema, cadPlan } from "./cad/model";
import { getCad, saveCad } from "./cad/store";
import {
  searchMaterialProduct,
  productLookupSchema,
  ProductSearchError,
} from "./material-research";
import { randomUUID } from "node:crypto";
import type { Queryable } from "./repository";
import {
  visualSchema,
  estimateSchema,
  calculateEstimate,
  type RoomPlan,
} from "./room-artifacts";
import { constructionSchema, validateConstruction } from "./construction-plan";
export async function runRoomTool(
  db: Queryable,
  owner: string,
  projectId: string,
  name: string,
  args: unknown,
  options?: { productSearch?: boolean },
) {
  const owned = await db.query(
    "SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",
    [projectId, owner],
  );
  if (!owned.rows.length) throw new Error("Room not found.");
  if (["search_material_product","update_room_cad","create_material_estimate","create_construction_plan"].includes(name)) await requirePaid(db, owner);
  if (name === "search_material_product") {
    const lookup = productLookupSchema.parse(args);
    const bill = await db.query(
      "SELECT id,data FROM roomwise.artifacts WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='estimate'",
      [lookup.estimateId, projectId, owner],
    );
    if (!bill.rows.length)
      throw new Error("Choose a material bill from this room.");
    const comparison = await searchMaterialProduct(
      db,
      owner,
      lookup.estimateId,
      bill.rows[0].data,
      lookup.index,
      lookup.preferences,
    );
    return {
      id: lookup.estimateId,
      kind: "estimate",
      productIndex: lookup.index,
      products: comparison.products,
      summary:
        "Product comparison saved for the requested item. The user can compare packs, quantities, prices and links, then choose a product in Materials. Do not claim an entire basket was researched.",
    };
  }
  if (name === "update_room_cad") {
    const { model, baseRevision, changeSummary } = cadUpdateSchema.parse(args);
    const current = await getCad(db, owner, projectId);
    const cad = await saveCad(
      db,
      owner,
      projectId,
      baseRevision,
      {
        ...model,
        ...(current?.model.appearance
          ? { appearance: current.model.appearance }
          : {}),
        confirmed: false,
      },
      "ai",
      changeSummary,
    );
    return {
      id: projectId,
      kind: "cad",
      revision: cad.revision,
      summary: changeSummary,
    };
  }
  if (name === "create_material_estimate" && options?.productSearch) {
    const existing = await db.query(
      "SELECT id FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='estimate' LIMIT 1",
      [projectId, owner],
    );
    if (existing.rows.length)
      throw new ProductSearchError(
        "Use the existing bill for this product search; a comparison cannot replace or shorten it.",
      );
  }
  let kind: string, data: Record<string, unknown>;
  if (name === "create_construction_plan") {
    const plan = constructionSchema.parse(args);
    const bill = await db.query(
      "SELECT id,kind,data FROM roomwise.artifacts WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='estimate'",
      [plan.estimateId, projectId, owner],
    );
    if (!bill.rows.length)
      throw new Error(
        "Create the complete bill of materials before the construction plan.",
      );
    validateConstruction(plan, {
      id: bill.rows[0].id,
      kind: bill.rows[0].kind,
      data: bill.rows[0].data,
    });
    kind = "construction";
    data = plan;
  } else if (name === "prepare_room_visual") {
    const visual = visualSchema.parse(args);
    const photo = await db.query(
      "SELECT id FROM roomwise.photos WHERE id=$1 AND project_id=$2 AND user_id=$3",
      [visual.sourcePhotoId, projectId, owner],
    );
    if (!photo.rows.length)
      throw new Error("Choose an original photo uploaded to this room.");
    kind = "visual";
    data = visual;
  } else if (name === "create_material_estimate") {
    const estimate = estimateSchema.parse(args);

    const cad = await getCad(db, owner, projectId);
    const plan = cad ? cadPlan(cad.model) : (null as RoomPlan | null);
    const calculations = calculateEstimate(estimate, plan);
    kind = "estimate";
    data = {
      ...estimate,
      plan,
      planId: null,
      cadRevision: cad?.revision || null,
      calculations,
      priceSources: [],
    };
  } else throw new Error("Unknown room skill.");
  const id = randomUUID();
  await db.query(
    "INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data,model) VALUES($1,$2,$3,$4,$5::jsonb,'gpt-6-luna')",
    [id, owner, projectId, kind, JSON.stringify(data)],
  );
  if (kind === "visual")
    await db.query(
      "UPDATE roomwise.artifacts SET status='queued' WHERE id=$1 AND user_id=$2",
      [id, owner],
    );
  return {
    id,
    products: [],
    kind,
    summary:
      kind === "construction"
        ? "Construction checklist saved, linked to the bill rows. The app shows the ordered steps, materials, tools and supplier links directly in chat and in the project Construction plan folder. Provide only a short polished introduction."
        : kind === "estimate"
          ? "Bill saved with quantities, estimated allowances and Excel export. No internet search has run. Product search is an optional advanced capability for ONE item explicitly requested by the user."
          : "Before/after design saved and queued. The application automatically starts one image edit for signed-in accounts with credits and shows it directly in chat and also saves it in the project visual folder. Do not say it is finished yet.",
  };
}
