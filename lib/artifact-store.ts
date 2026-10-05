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
    const plan = (latest.rows[0]?.data || null) as RoomPlan | null;
    const calculations = calculateEstimate(estimate, plan);
    kind = "estimate";
    data = {
      ...estimate,
      plan,
      planId: latest.rows[0]?.id || null,
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
  return {
    id,
    kind,
    summary:
      kind === "plan"
        ? "2D plan and material assessment saved; dimensions await user confirmation."
        : kind === "estimate"
          ? "Bill of materials saved with quantities, estimated costs, local shopping searches and a ready Excel download. Local price research is available on its card."
          : "Before/after brief saved. The user can generate one concept on its card; no image has been generated yet.",
  };
}
