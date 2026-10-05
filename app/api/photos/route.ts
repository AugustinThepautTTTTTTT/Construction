import { randomUUID } from "node:crypto";
import { normalizePhoto, limitedFormData } from "@/lib/photo-upload";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { identity, sameOrigin, error } from "@/lib/server";
import { PHOTO_LIMITS, PHOTO_TYPES } from "@/lib/photos";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  if (Number(r.headers.get("content-length")) > 2 * 1024 * 1024)
    return error("Please upload smaller photos.", 413);
  try {
    const user = await identity(r),
      db = await database();
    if (!user?.email || !db)
      return error("Sign in to upload room photos.", 401);
    if (!(await rateLimit(`photos:${user.id}`, 30, 3600)))
      return error("Please wait before uploading more photos.", 429);
    const form = await limitedFormData(r),
      projectId = form.get("projectId"),
      files = form.getAll("photos");
    if (
      !z.string().uuid().safeParse(projectId).success ||
      !files.length ||
      files.length > PHOTO_LIMITS.perMessage
    )
      return error("Choose a room and up to three photos.", 400);
    const owned = await db.query(
      "SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",
      [projectId, user.id],
    );
    if (!owned.rows.length) return error("Room not found.", 404);
    const photos = [];
    for (const file of files) {
      if (
        !(file instanceof File) ||
        !PHOTO_TYPES.includes(file.type) ||
        file.size > PHOTO_LIMITS.uploadBytes
      )
        return error(
          "Choose JPG, PNG or WebP photos under 512 KB after compression.",
          400,
        );
      const data = await normalizePhoto(Buffer.from(await file.arrayBuffer()));
      photos.push({ id: randomUUID(), data });
    }
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [projectId, user.id],
      );
      const count = await c.query(
        "SELECT count(*)::int AS n FROM roomwise.photos WHERE project_id=$1",
        [projectId],
      );
      if (count.rows[0].n + photos.length > PHOTO_LIMITS.perRoom) {
        await c.query("ROLLBACK");
        return error("This room has reached its limit of 12 photos.", 400);
      }
      for (const photo of photos)
        await c.query(
          "INSERT INTO roomwise.photos(id,user_id,project_id,data) VALUES($1,$2,$3,$4)",
          [photo.id, user.id, projectId, photo.data],
        );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    return NextResponse.json({ photoIds: photos.map((p) => p.id) });
  } catch {
    return error(
      "Could not upload these photos. Try JPG, PNG or WebP images.",
      400,
    );
  }
}
