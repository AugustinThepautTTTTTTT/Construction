import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { splitParagraphs, type ChatEvent } from "@/lib/chat-stream";
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
  photoIds: z.array(z.string().uuid()).max(3).default([]),
});
export const maxDuration = 60;
export async function POST(r: NextRequest) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  const parsed = schema.safeParse(await r.json().catch(() => null));
  if (!parsed.success)
    return error("Please shorten your message or choose a room.", 400);
  try {
    const user = await identity(r);
    const db = await database();
    if (!db || !user?.email)
      return error(
        "Create an account or sign in before using the planner.",
        401,
      );
    const repo = new ProjectRepository(db);
    const p = await repo.get(user.id, parsed.data.projectId);
    if (!p) return error("Project not found.", 404);
    if (!user.pro_active && !p.paid && (p.previewUsed || user.free_trial_used))
      return error(
        "Your account’s free test has been used. Choose a Room Pass or Pro to continue.",
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
    const photoIds = parsed.data.photoIds;
    // Continue using the most recently shared room photos on follow-up turns.
    const contextPhotos = photoIds.length
      ? photoIds
      : p.messages.filter((m) => m.role === "user" && m.photoIds?.length).at(-1)
          ?.photoIds || [];
    const photos = contextPhotos.length
      ? (
          await db.query(
            "SELECT id,data FROM roomwise.photos WHERE id=ANY($1::uuid[]) AND user_id=$2 AND project_id=$3",
            [contextPhotos, user.id, p.id],
          )
        ).rows
      : [];
    if (photos.length !== contextPhotos.length)
      return error("One of these photos does not belong to this room.", 400);
    if (p.messages.length >= 200)
      return error("Start a new room to continue.", 400);
    const generationId = randomUUID();
    const lock = await db.connect();
    try {
      await lock.query("BEGIN");
      await lock.query(
        "SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [p.id, user.id],
      );
      const expired = await lock.query(
        "UPDATE roomwise.generations SET status='failed' WHERE project_id=$1 AND status='running' AND created_at<now()-interval '2 minutes' RETURNING id",
        [p.id],
      );
      if (expired.rows.length)
        await lock.query(
          `UPDATE roomwise.projects SET messages=(SELECT jsonb_agg(CASE WHEN item->>'generationId'=ANY($2::text[]) THEN item || '{"status":"failed"}'::jsonb ELSE item END ORDER BY ord) FROM jsonb_array_elements(messages) WITH ORDINALITY AS t(item,ord)) WHERE id=$1`,
          [p.id, expired.rows.map((row) => row.id)],
        );
      const existing = await lock.query(
        "SELECT id FROM roomwise.generations WHERE project_id=$1 AND status='running'",
        [p.id],
      );
      if (existing.rows.length) {
        await lock.query("ROLLBACK");
        return error("A reply is already being prepared for this room.", 409);
      }
      await lock.query(
        "INSERT INTO roomwise.generations(id,project_id) VALUES($1,$2)",
        [generationId, p.id],
      );
      await lock.query("COMMIT");
    } catch (e) {
      await lock.query("ROLLBACK");
      throw e;
    } finally {
      lock.release();
    }
    let claimed = false;
    const releaseTrial = async () => {
      if (claimed)
        await db.query(
          `WITH released AS (DELETE FROM roomwise.free_trials WHERE project_id=$1 AND user_id=$2 RETURNING project_id) UPDATE roomwise.projects SET preview_used=false WHERE id IN (SELECT project_id FROM released)`,
          [p.id, user.id],
        );
    };
    try {
      if (!user.pro_active && !p.paid) {
        claimed = await repo.claimPreview(user.id, p.id);
        if (!claimed) {
          await db.query(
            "UPDATE roomwise.generations SET status='failed' WHERE id=$1",
            [generationId],
          );
          return error(
            "Your account’s free test is already being prepared or has been used.",
            402,
          );
        }
      }
      const policy = aiPolicy();
      if (!policy && contextPhotos.length) throw new Error("AI_UNAVAILABLE");
      if (policy && !(await reserveAiCall(db, policy.limitCents)))
        throw new Error("BUDGET_EXHAUSTED");
      const instructions =
        ROOM_PLANNER_PROMPT +
        `\nRoom brief: ${JSON.stringify(p.brief)}\nUse blank lines between paragraphs. When photos are supplied, describe relevant visible details and distinguish observations from assumptions. Never infer exact dimensions from photographs. Briefly explain the practical rationale for key recommendations without exposing private reasoning.`;
      const history = boundedInput(
        instructions,
        p.messages,
        parsed.data.message,
      );
      const input: OpenAI.Responses.ResponseInput = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      if (photos.length)
        input[input.length - 1] = {
          role: "user",
          content: [
            { type: "input_text", text: parsed.data.message },
            ...photos.map((photo) => ({
              type: "input_image" as const,
              detail: "low" as const,
              image_url: `data:image/jpeg;base64,${photo.data.toString("base64")}`,
            })),
          ],
        };
      await repo.append(user.id, p.id, [
        { role: "user", content: parsed.data.message, photoIds },
        {
          role: "assistant",
          content: "",
          generationId,
          status: "running",
          model: policy?.model,
        },
      ]);
      let connected = true;
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: ChatEvent) => {
            if (connected)
              try {
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(event) + "\n"),
                );
              } catch {
                connected = false;
              }
          };
          let saved = "",
            pending = "";
          const paragraph = async (text: string) => {
            saved += text;
            await repo.saveReply(user.id, p.id, generationId, saved, "running");
            emit({ type: "paragraph", text });
          };
          try {
            emit({
              type: "status",
              message: photos.length
                ? "Reviewing your room photos and request…"
                : "Reviewing your room and request…",
            });
            let usage:
              { input_tokens: number; output_tokens: number } | undefined;
            if (policy) {
              const client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                timeout: 40000,
                maxRetries: 0,
              });
              const response = await client.responses.create({
                model: policy.model,
                instructions,
                input,
                reasoning: { effort: "none" },
                service_tier: "default",
                max_output_tokens: CHAT_LIMITS.maxOutputTokens,
                store: false,
                stream: true,
              });
              let completed = false;
              for await (const event of response) {
                if (event.type === "response.created")
                  emit({
                    type: "status",
                    message: "Preparing your room plan…",
                  });
                if (event.type === "response.output_text.delta") {
                  pending += event.delta;
                  const blocks = splitParagraphs(pending);
                  pending = blocks.remainder;
                  for (const block of blocks.paragraphs) await paragraph(block);
                }
                if (event.type === "response.completed") {
                  completed = true;
                  usage = event.response.usage || undefined;
                }
                if (event.type === "response.failed" || event.type === "error")
                  throw new Error("PROVIDER_FAILED");
                if (event.type === "response.incomplete")
                  throw new Error("REPLY_INCOMPLETE");
              }
              if (!completed) throw new Error("PROVIDER_INTERRUPTED");
            } else pending = makePreview(p.brief);
            if (pending) await paragraph(pending);
            if (!saved.trim()) throw new Error("EMPTY_REPLY");
            emit({ type: "status", message: "Saving your plan…" });
            await repo.saveReply(
              user.id,
              p.id,
              generationId,
              saved,
              "complete",
              usage,
            );
            await db.query(
              "UPDATE roomwise.generations SET status='complete' WHERE id=$1",
              [generationId],
            );
            await db.query(
              "UPDATE roomwise.projects SET preview_used=true WHERE id=$1 AND user_id=$2",
              [p.id, user.id],
            );
            emit({ type: "done" });
          } catch (e) {
            // Never log raw provider errors: they can contain user content or credentials.
            console.error("Roomwise planner failed", {
              status: e instanceof OpenAI.APIError ? e.status : undefined,
              code: e instanceof OpenAI.APIError ? e.code : "stream_failure",
            });
            await repo
              .saveReply(user.id, p.id, generationId, saved, "failed")
              .catch(() => {});
            await db
              .query(
                "UPDATE roomwise.generations SET status='failed' WHERE id=$1",
                [generationId],
              )
              .catch(() => {});
            await releaseTrial().catch(() => {});
            const quota =
              e instanceof OpenAI.APIError &&
              ["insufficient_quota", "credit_balance_exhausted"].includes(
                e.code || "",
              );
            emit({
              type: "error",
              message: quota
                ? "The planner’s API credit balance is unavailable. Please contact Roomwise support."
                : "The planner could not finish this reply. Your chat is saved; please retry.",
            });
          } finally {
            if (connected)
              try {
                controller.close();
              } catch {}
          }
        },
        cancel() {
          connected = false;
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (e) {
      await db.query(
        "UPDATE roomwise.generations SET status='failed' WHERE id=$1",
        [generationId],
      );
      await releaseTrial();
      return error(
        e instanceof Error && e.message === "BUDGET_EXHAUSTED"
          ? "The PoC AI budget has been reached."
          : "AI planning is temporarily unavailable. Your saved plan is safe.",
      );
    }
  } catch {
    return error(
      "The planner is temporarily unavailable. Your saved plan is safe.",
    );
  }
}
