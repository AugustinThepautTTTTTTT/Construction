import { projectGeometry } from "@/lib/project-geometry";
import OpenAI from "openai";
import { researchMaterialPrices } from "@/lib/material-research";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, sameOrigin, error } from "@/lib/server";
import { database } from "@/lib/database";
export const maxDuration = 180;
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
      return error("Sign in to check local prices.", 401);
    if (!z.string().uuid().safeParse(id).success)
      return error("Estimate not found.", 404);
    const result = await db.query(
      "SELECT a.data,a.project_id,p.paid FROM roomwise.artifacts a JOIN roomwise.projects p ON p.id=a.project_id WHERE a.id=$1 AND a.user_id=$2 AND a.kind='estimate'",
      [id, user.id],
    );
    if (!result.rows.length) return error("Estimate not found.", 404);
    if (!user.pro_active && !result.rows[0].paid)
      return error(
        "A Room Pass or Pro is required for live price research.",
        402,
      );
    const row=result.rows[0],geometry=await projectGeometry(db,user.id,row.project_id);
    const data=geometry?{...row.data,...geometry}:row.data;
    const sources = await researchMaterialPrices(db, user.id, id, data);
    return NextResponse.json({ count: sources.length });
  } catch (e) {
    console.error("Roomwise price research failed", {
      status: e instanceof OpenAI.APIError ? e.status : undefined,
      code: e instanceof OpenAI.APIError ? e.code : undefined,
      param: e instanceof OpenAI.APIError ? e.param : undefined,
    });
    return error(
      "Could not verify provider prices. Unverified items remain estimated allowances; try again later.",
    );
  }
}
