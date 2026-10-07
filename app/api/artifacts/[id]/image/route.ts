import { randomUUID } from "node:crypto";
import {debitCredits, refundCredits, CreditError} from "@/lib/credits";
import { getCad } from "@/lib/cad/store";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, sameOrigin, error } from "@/lib/server";
import { database, rateLimit } from "@/lib/database";
import { aiPolicy } from "@/lib/ai-budget";
import {visualRequestedForArtifact} from "@/lib/project-intent";
import { visualSchema } from "@/lib/room-artifacts";
import {
  roomVisualPrompt,
  ROOM_IMAGE_MODEL,
} from "@/lib/room-visual";
export const maxDuration = 300;
export async function GET(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await identity(r),
      db = await database(),
      { id } = await params;
    if (!user?.email || !db) return error("Sign in to view this concept.", 401);
    if (!z.string().uuid().safeParse(id).success)
      return error("Concept not found.", 404);
    const result = await db.query(
      "SELECT image FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='visual' AND image IS NOT NULL",
      [id, user.id],
    );
    if (!result.rows.length) return error("Concept not found.", 404);
    return new Response(new Uint8Array(result.rows[0].image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error("Could not load this concept.");
  }
}
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(r)) return error("Invalid request origin.", 403);
  let artifactId: string | undefined, owner: string | undefined;
  const operation = `image:${randomUUID()}`;
  try {
    const user = await identity(r),
      db = await database(),
      { id } = await params;
    if (!user?.email || !db) return error("Sign in to create a concept.", 401);
    if (!z.string().uuid().safeParse(id).success)
      return error("Concept not found.", 404);
    const result = await db.query(
      "SELECT a.*,p.messages FROM roomwise.artifacts a JOIN roomwise.projects p ON p.id=a.project_id WHERE a.id=$1 AND a.user_id=$2 AND a.kind='visual'",
      [id, user.id],
    );
    if (!result.rows.length) return error("Concept not found.", 404);
    const a = result.rows[0];
    if (a.image) return NextResponse.json({ ready: true });
    const rejectQueued=async(message:string,status=400)=>{if(a.status==="queued")await db.query("UPDATE roomwise.artifacts SET status='failed',data=data || $1::jsonb WHERE id=$2 AND user_id=$3 AND status='queued'",[JSON.stringify({generationError:message}),id,user.id]);return error(message,status);};
    if(a.data.visualAuthorized !== true && !visualRequestedForArtifact(a.messages||[],id))return rejectQueued("This message requested materials or work instructions, so no image will be generated.");
    const policy = aiPolicy();
    if (!policy)
      return rejectQueued("Image generation is temporarily unavailable.");
    const visual = visualSchema.parse({
        title: a.data.title,
        sourcePhotoId: a.data.sourcePhotoId,
        brief: a.data.brief,
        retain: a.data.retain,
        changes: a.data.changes,
      }),
      photo = await db.query(
        "SELECT data FROM roomwise.photos WHERE id=$1 AND user_id=$2 AND project_id=$3",
        [visual.sourcePhotoId, user.id, a.project_id],
      );
    if (!photo.rows.length) return rejectQueued("Original room photo not found.", 404);
    const revision = a.data.revisionSourceId ? await db.query(
      "SELECT image,data FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND project_id=$3 AND kind='visual' AND image IS NOT NULL AND data->>'sourcePhotoId'=$4",
      [a.data.revisionSourceId,user.id,a.project_id,visual.sourcePhotoId],
    ) : null;
    if (a.data.revisionSourceId && !revision?.rows.length) return rejectQueued("The earlier concept is unavailable. Your edit is saved; select the intended concept before retrying.",409);
    const c = await db.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT id FROM roomwise.projects WHERE id=$1 FOR UPDATE", [
        a.project_id,
      ]);
      await c.query(
        "UPDATE roomwise.artifacts SET status='failed' WHERE project_id=$1 AND kind='visual' AND status='running' AND (data->>'startedAt')::timestamptz<now()-interval '6 minutes'",
        [a.project_id],
      );
      const claim = await c.query(
        "UPDATE roomwise.artifacts SET status='running',data=data || jsonb_build_object('startedAt',now()) WHERE id=$1 AND user_id=$2 AND status<>'running' AND image IS NULL RETURNING id",
        [id, user.id],
      );
      if (!claim.rows.length) {
        await c.query("ROLLBACK");
        return error("This concept is already being generated.", 409);
      }
      await debitCredits(c, user.id, operation, "image", a.project_id);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    artifactId = id;
    owner = user.id;
    const original = await sharp(photo.rows[0].data)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 240000,
      maxRetries: 0,
    });
    const meta = await sharp(original).metadata();
    const ratio = (meta.width || 1) / (meta.height || 1),
      size =
        ratio > 1.2 ? "1536x1024" : ratio < 0.8 ? "1024x1536" : "1024x1024";
    const currentCad = await getCad(db,user.id,a.project_id);
    const response = await client.images.edit({
      model: ROOM_IMAGE_MODEL,
      image: revision ? [
        await toFile(await sharp(revision.rows[0].image).resize(1536,1536,{fit:"inside",withoutEnlargement:true}).jpeg({quality:85}).toBuffer(), "current-concept.jpg", {type:"image/jpeg"}),
        await toFile(original, "original-room.jpg", {type:"image/jpeg"}),
      ] : await toFile(original, "room.jpg", { type: "image/jpeg" }),
      prompt: roomVisualPrompt(visual,currentCad?.model,!!revision),
      n: 1,
      size,
      quality: "medium",
      output_format: "jpeg",
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("NO_IMAGE");
    const image = await sharp(Buffer.from(encoded, "base64"), {
      limitInputPixels: 4000000,
    })
      .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    await db.query(
      "UPDATE roomwise.artifacts SET image=$1,status='ready',model=$2,data=data || $3::jsonb WHERE id=$4 AND user_id=$5",
      [
        image,
        ROOM_IMAGE_MODEL,
        JSON.stringify({
          usage: response.usage || null,
          generatedAt: new Date().toISOString(),
          cadRevision: currentCad?.revision || null,
        }),
        id,
        user.id,
      ],
    );

    return NextResponse.json({ ready: true });
  } catch (e) {
    const db = await database();
    if (owner && db) await refundCredits(db, owner, operation).catch(() => {});
    if (artifactId && db)
      await db
        .query(
          "UPDATE roomwise.artifacts SET status='failed',data=data || $3::jsonb WHERE id=$1 AND user_id=$2",
          [artifactId, owner,JSON.stringify({generationError:e instanceof CreditError?e.message:"The concept could not be generated. Your design brief is saved."})],
        )
        .catch(() => {});
    console.error("Archicova image generation failed", {
      status: e instanceof OpenAI.APIError ? e.status : undefined,
      code: e instanceof OpenAI.APIError ? e.code : "image_failure",
    });
    return error(
      e instanceof CreditError
        ? e.message
        : "Your concept could not finish. Your design is saved and the image credits have been returned. Please try again.", e instanceof CreditError ? 402 : 503,
    );
  }
}
