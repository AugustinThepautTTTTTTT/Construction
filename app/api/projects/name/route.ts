import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/database";
import { identity, sameOrigin, error } from "@/lib/server";
import { nameProject } from "@/lib/project-naming";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const body = z
    .object({ id: z.string().uuid() })
    .safeParse(await r.json().catch(() => null));
  if (!body.success) return error("Invalid chat.", 400);
  try {
    const user = await identity(r),
      db = await database();
    if (!user?.email || !db) return error("Sign in first.", 401);
    const title = await nameProject(db, user.id, body.data.id, "chat");
    return title ? NextResponse.json({ title }) : error("Chat not found.", 404);
  } catch {
    return error("Could not name this chat.");
  }
}
