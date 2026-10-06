import { getCad } from "@/lib/cad/store";
import { cadPlan } from "@/lib/cad/model";
import { NextRequest } from "next/server";
import { z } from "zod";
import { identity, error } from "@/lib/server";
import { database } from "@/lib/database";
import { materialWorkbook } from "@/lib/material-workbook";
export async function GET(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await identity(r),
      db = await database(),
      { id } = await params;
    if (!user?.email || !db)
      return error("Sign in to export this estimate.", 401);
    if (!z.string().uuid().safeParse(id).success)
      return error("Estimate not found.", 404);
    const result = await db.query(
      "SELECT data,project_id FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='estimate'",
      [id, user.id],
    );
    if (!result.rows.length) return error("Estimate not found.", 404);
    const row=result.rows[0],cad=await getCad(db,user.id,row.project_id);
    const data=cad?{...row.data,plan:cadPlan(cad.model),cadRevision:cad.revision}:row.data;
    return new Response(await materialWorkbook(data), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="roomwise-materials.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return error("Could not export this estimate.");
  }
}
