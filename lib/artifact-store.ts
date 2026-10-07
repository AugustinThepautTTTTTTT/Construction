import { cadUpdateSchema, cadPlan } from "./cad/model";
import { getCad, saveCad } from "./cad/store";
import OpenAI from "openai";
import { researchMaterialPrices } from "./material-research";
import { randomUUID } from "node:crypto";
import type { Queryable } from "./repository";
import {
  planSchema,
  visualSchema,
  estimateSchema,
  validatePlan,
  calculateEstimate,
  type RoomPlan,
} from "./room-artifacts";
export async function runRoomTool(
  db: Queryable,
  owner: string,
  projectId: string,
  name: string,
  args: unknown,
) {
  const owned = await db.query(
    "SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",
    [projectId, owner],
  );
  if (!owned.rows.length) throw new Error("Room not found.");
  if (name === "update_room_cad") {
    const {model,baseRevision,changeSummary} = cadUpdateSchema.parse(args);
    const current = await getCad(db,owner,projectId);
    const cad = await saveCad(db,owner,projectId,baseRevision,{...model,...(current?.model.appearance?{appearance:current.model.appearance}:{}),confirmed:false},"ai",changeSummary);
    return {id:projectId,kind:"cad",revision:cad.revision,summary:changeSummary};
  }
  let kind: string, data: Record<string, unknown>;
  if (name === "create_room_plan") {
    const plan = planSchema.parse(args);
    validatePlan(plan);
    kind = "plan";
    data = { ...plan, confirmed: false };
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
    const latest = await db.query(
      "SELECT id,data FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='plan' ORDER BY created_at DESC LIMIT 1",
      [projectId, owner],
    );
    const cad = await getCad(db,owner,projectId);
    const plan = cad ? cadPlan(cad.model) : (latest.rows[0]?.data || null) as RoomPlan | null;
    const calculations = calculateEstimate(estimate, plan);
    kind = "estimate";
    data = {
      ...estimate,
      plan,
      planId: cad ? null : latest.rows[0]?.id || null,
      cadRevision: cad?.revision || null,
      calculations,
      priceSources: [],
    };
  } else throw new Error("Unknown room skill.");
  const count = await db.query(
    "SELECT count(*)::int AS n FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2",
    [projectId, owner],
  );
  if (count.rows[0].n >= 30)
    throw new Error(
      "This room has reached its limit of 30 saved deliverables. Start another room.",
    );
  const id = randomUUID();
  await db.query(
    "INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data,model) VALUES($1,$2,$3,$4,$5::jsonb,'gpt-6-luna')",
    [id, owner, projectId, kind, JSON.stringify(data)],
  );
  if(kind === "visual")await db.query("UPDATE roomwise.artifacts SET status='queued' WHERE id=$1 AND user_id=$2",[id,owner]);
  let products: unknown[] = [], researchNotice = "";
  if (kind === "estimate") {
    try { products = await researchMaterialPrices(db, owner, id, data); }
    catch (e) { console.error("Roomwise automatic price research failed", {status: e instanceof OpenAI.APIError ? e.status : undefined, code: e instanceof OpenAI.APIError ? e.code : undefined, param: e instanceof OpenAI.APIError ? e.param : undefined}); researchNotice = "Provider prices could not be verified. These are estimated allowances, not product quotes."; }
    if (researchNotice) await db.query("UPDATE roomwise.artifacts SET data=data || $1::jsonb WHERE id=$2 AND user_id=$3", [JSON.stringify({researchNotice}), id, owner]);
  }
  return {
    id,
    products,
    researchNotice,
    kind,
    summary:
      kind === "plan"
        ? "2D plan and material assessment saved; dimensions await user confirmation."
        : kind === "estimate"
          ? "Bill saved with quantities and Excel export. Only products in products have verified provider links/prices; all other lines are estimated allowances. Discuss unmatched items instead of claiming a fully sourced basket."
          : "Before/after design saved and queued. The application automatically starts one image edit for eligible paid accounts and shows it directly in chat and also saves it in the project visual folder. Do not say it is finished yet.",
  };
}
