import { NextRequest, NextResponse } from "next/server";
import { briefSchema, makePreview } from "@/lib/domain";
import { sameOrigin, error } from "@/lib/server";
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  if (Number(r.headers.get("content-length")) > 10000)
    return error("Please shorten the brief.", 413);
  const parsed = briefSchema.safeParse(await r.json().catch(() => null));
  if (!parsed.success)
    return error("Add a room and a short goal to continue.", 400);
  return NextResponse.json({
    message: makePreview(parsed.data),
    kind: "guided_preview",
  });
}
