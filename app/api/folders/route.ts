import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { identity, sameOrigin, error } from "@/lib/server";
import {
  listFolders,
  createFolder,
  assignChat,
  folderAssets,
} from "@/lib/project-folders";
import { nameProject } from "@/lib/project-naming";
export const dynamic = "force-dynamic";
export async function GET(r: NextRequest) {
  try {
    const user = await identity(r),
      db = await database();
    if (!user?.email || !db) return error("Sign in to open projects.", 401);
    const id = r.nextUrl.searchParams.get("id");
    if (id) {
      if (!z.string().uuid().safeParse(id).success)
        return error("Invalid project.", 400);
      const assets = await folderAssets(db, user.id, id);
      return assets
        ? NextResponse.json(assets)
        : error("Project not found.", 404);
    }
    return NextResponse.json({ folders: await listFolders(db, user.id) });
  } catch {
    return error("Could not load projects.");
  }
}
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const body = z
    .object({ description: z.string().trim().min(2).max(900) })
    .safeParse(await r.json().catch(() => null));
  if (!body.success) return error("Describe your project.", 400);
  try {
    const user = await identity(r),
      db = await database();
    if (!user?.email || !db) return error("Sign in first.", 401);
    if (!(await rateLimit(`folder:${user.id}`, 20, 3600)))
      return error("Please wait before creating more projects.", 429);
    const folder = await createFolder(db, user.id, body.data.description);
    const title = await nameProject(db, user.id, folder.id, "folder");
    return NextResponse.json({
      folder: { ...folder, title: title || folder.title },
    });
  } catch {
    return error("Could not create the project.");
  }
}
export async function PATCH(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const body = z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("assign"),
        chatId: z.string().uuid(),
        folderId: z.string().uuid().nullable(),
      }),
      z.object({
        action: z.literal("rename"),
        folderId: z.string().uuid(),
        title: z.string().trim().min(1).max(65),
      }),
    ])
    .safeParse(await r.json().catch(() => null));
  if (!body.success) return error("Invalid project change.", 400);
  try {
    const user = await identity(r),
      db = await database();
    if (!user?.email || !db) return error("Sign in first.", 401);
    const b = body.data;
    if (b.action === "assign") {
      if (!(await assignChat(db, user.id, b.chatId, b.folderId)))
        return error("Chat or project not found.", 404);
    } else {
      const saved = await db.query(
        "UPDATE roomwise.project_folders SET title=$3,title_status='custom' WHERE id=$1 AND user_id=$2 RETURNING id",
        [b.folderId, user.id, b.title],
      );
      if (!saved.rows.length) return error("Project not found.", 404);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return error("Could not update the project.");
  }
}
