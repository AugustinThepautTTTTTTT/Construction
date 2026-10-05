import { NextRequest } from "next/server";
import { z } from "zod";
import { database } from "@/lib/database";
import { identity, error } from "@/lib/server";
export async function GET(
  r: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await identity(r),
      db = await database(),
      { id } = await context.params;
    if (!user?.email || !db) return error("Sign in to view this photo.", 401);
    if (!z.string().uuid().safeParse(id).success)
      return error("Photo not found.", 404);
    const result = await db.query(
      "SELECT data FROM roomwise.photos WHERE id=$1 AND user_id=$2",
      [id, user.id],
    );
    if (!result.rows.length) return error("Photo not found.", 404);
    return new Response(new Uint8Array(result.rows[0].data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return error("Could not load this photo.");
  }
}
