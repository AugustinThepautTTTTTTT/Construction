import OpenAI from "openai";
import { aiPolicy, boundedInput, reserveAiCall } from "@/lib/ai-budget";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, rateLimit } from "@/lib/database";
import { ProjectRepository } from "@/lib/repository";
import { ROOM_PLANNER_PROMPT, CHAT_LIMITS } from "@/lib/room-planner";
import { identity, sameOrigin, error } from "@/lib/server";
import { makePreview } from "@/lib/domain";
const schema = z.object({
  projectId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const parsed = schema.safeParse(await r.json().catch(() => null));
  if (!parsed.success)
    return error("Please shorten your message or choose a room.", 400);
  try {
    const user = await identity(r);
    const db = await database();
    if (!db || !user)
      return error(
        "Cloud planning is not available yet. You can still use the free starter preview.",
      );
    const repo = new ProjectRepository(db);
    const p = await repo.get(user.id, parsed.data.projectId);
    if (!p) return error("Project not found.", 404);
    if (!user.pro_active && !p.paid && p.previewUsed)
      return error(
        "Your free preview is ready. Unlock this room to continue.",
        402,
      );
    if (
      !(await rateLimit(`chat:${user.id}`, user.pro_active ? 120 : 40, 86400))
    )
      return error(
        "You have reached today’s planning limit. Please return tomorrow.",
        429,
      );
    if (p.messages.length > 200)
      return error("Start a new room to continue.", 400);
    if (!user.pro_active && !p.paid) {
      const claim = await repo.claimPreview(user.id, p.id);
      if (!claim)
        return error(
          "Your free preview is already being prepared or is ready.",
          402,
        );
    }
    let message: string;
    let kind = "guided_preview";
    const policy = aiPolicy();
    if (!policy) {
      if (p.previewUsed)
        return error(
          "AI planning is temporarily unavailable. Your saved plan is safe.",
        );
      message = makePreview(p.brief);
    } else {
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 40000,
        maxRetries: 0,
      });
      let response;
      try {
        const instructions =
          ROOM_PLANNER_PROMPT + `\nRoom brief: ${JSON.stringify(p.brief)}`;
        const input = boundedInput(
          instructions,
          p.messages,
          parsed.data.message,
        );
        if (!(await reserveAiCall(db, policy.limitCents))) {
          throw new Error("PoC AI budget exhausted");
        }
        response = await client.responses.create({
          model: policy.model,
          instructions,
          input,
          reasoning: { effort: "none" },
          service_tier: "default",
          max_output_tokens: CHAT_LIMITS.maxOutputTokens,
          store: false,
        });
      } catch (e) {
        if (!user.pro_active && !p.paid)
          await db.query(
            "UPDATE roomwise.projects SET preview_used=false WHERE id=$1 AND user_id=$2",
            [p.id, user.id],
          );
        throw e;
      }
      message =
        response.output_text ||
        "Please add the room dimensions and your main priority.";
      kind = "ai";
    }
    await repo.append(user.id, p.id, [
      { role: "user", content: parsed.data.message },
      { role: "assistant", content: message },
    ]);
    await db.query(
      "UPDATE roomwise.projects SET preview_used=true WHERE id=$1 AND user_id=$2",
      [p.id, user.id],
    );
    return NextResponse.json({ message, kind });
  } catch {
    return error(
      "The planner is temporarily unavailable. Your saved plan is safe.",
    );
  }
}
