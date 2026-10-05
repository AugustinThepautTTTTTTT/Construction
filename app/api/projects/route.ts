import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { ProjectRepository } from "@/lib/repository";
import { briefSchema } from "@/lib/domain";
import { identity, sameOrigin, error } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET(r: NextRequest) {
  try {
    const user = await identity(r);
    const db = await database();
    if (!db) return error("Cloud saving is not available yet.");
    if (!user) return error("Please open a workspace first.", 401);
    const id = r.nextUrl.searchParams.get("id");
    if (id) {
      if (!z.string().uuid().safeParse(id).success)
        return error("Invalid project.", 400);
      const p = await new ProjectRepository(db).get(user.id, id);
      return p
        ? NextResponse.json({ project: p })
        : error("Project not found.", 404);
    }
    return NextResponse.json({
      projects: await new ProjectRepository(db).list(user.id),
    });
  } catch {
    return error("Could not load cloud projects. Your browser copy is safe.");
  }
}
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const parsed = briefSchema.safeParse(await r.json().catch(() => null));
  if (!parsed.success) return error("Add a valid room brief.", 400);
  try {
    const user = await identity(r);
    const db = await database();
    if (!db) return error("Cloud saving is not available yet.");
    if (!user) return error("Please open a workspace first.", 401);
    if (!(await rateLimit(`project:${user.id}`, 20, 3600)))
      return error("Please wait before creating more rooms.", 429);
    return NextResponse.json({
      project: await new ProjectRepository(db).create(user.id, parsed.data),
    });
  } catch {
    return error("Could not save to the cloud. Your browser copy is safe.");
  }
}
