import { projectGeometry } from "@/lib/project-geometry";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, sameOrigin, error } from "@/lib/server";
import { database } from "@/lib/database";
import {
  validatePlan,
  planSchema,
  calculateEstimate,
} from "@/lib/room-artifacts";
export async function GET(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await identity(r),
      db = await database(),
      { id } = await params;
    if (!user?.email || !db)
      return error("Sign in to view this deliverable.", 401);
    if (!z.string().uuid().safeParse(id).success)
      return error("Deliverable not found.", 404);
    const result = await db.query(
      'SELECT id,project_id,kind,data,status,model,(image IS NOT NULL) AS "hasImage",created_at FROM roomwise.artifacts WHERE id=$1 AND user_id=$2',
      [id, user.id],
    );
    const artifact=result.rows[0];
    if(artifact?.kind === "estimate"){
      const geometry=await projectGeometry(db,user.id,artifact.project_id);
      if(geometry){artifact.data={...artifact.data,...geometry};artifact.data.calculations=calculateEstimate(artifact.data,artifact.data.plan);}
    }
    return result.rows.length
      ? NextResponse.json(
          { artifact: result.rows[0] },
          { headers: { "Cache-Control": "private, no-store" } },
        )
      : error("Deliverable not found.", 404);
  } catch {
    return error("Could not load this deliverable.");
  }
}
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  try {
    const user = await identity(r),
      db = await database(),
      { id } = await params;
    if (!user?.email || !db)
      return error("Sign in to confirm measurements.", 401);
    if (!z.string().uuid().safeParse(id).success)
      return error("Deliverable not found.", 404);
    const body = await r.json().catch(() => null);
    if (body?.action !== "confirm_measurements")
      return error("Invalid action.", 400);
    const result = await db.query(
      "SELECT data FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='plan'",
      [id, user.id],
    );
    if (!result.rows.length) return error("Plan not found.", 404);
    const { confirmed, ...raw } = result.rows[0].data;
    const plan = planSchema.parse(raw);
    validatePlan(plan);
    await db.query(
      "UPDATE roomwise.artifacts SET data=jsonb_set(data,'{confirmed}','true') WHERE id=$1 AND user_id=$2",
      [id, user.id],
    );
    const estimates = await db.query(
      "SELECT id,data FROM roomwise.artifacts WHERE user_id=$1 AND kind='estimate' AND data->>'planId'=$2",
      [user.id, id],
    );
    for (const row of estimates.rows) {
      const data = { ...row.data, plan: { ...plan, confirmed: true } };
      data.calculations = calculateEstimate(data, data.plan);
      await db.query(
        "UPDATE roomwise.artifacts SET data=$1::jsonb WHERE id=$2 AND user_id=$3",
        [JSON.stringify(data), row.id, user.id],
      );
    }
    return NextResponse.json({ confirmed: true });
  } catch {
    return error("Could not confirm these measurements.");
  }
}
