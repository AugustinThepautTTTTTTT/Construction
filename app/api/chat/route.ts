import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CHAT_LIMITS, ROOM_PLANNER_PROMPT } from "@/lib/room-planner";

const requestSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(CHAT_LIMITS.maxCharactersPerMessage) })).min(1).max(CHAT_LIMITS.maxMessages),
});
const buckets = new Map<string, { count: number; reset: number }>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (bucket && bucket.reset > now && bucket.count >= 12) return NextResponse.json({ error: "You’ve reached the minute limit. Please try again shortly." }, { status: 429 });
  buckets.set(ip, !bucket || bucket.reset <= now ? { count: 1, reset: now + 60_000 } : { ...bucket, count: bucket.count + 1 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please shorten your message or start a new project." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ message: "Your workspace is ready. Add OPENAI_API_KEY to connect the planning agent. For this room, I’ll first need the room type, approximate size, location, target budget, and the change you want most." });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.1",
      instructions: ROOM_PLANNER_PROMPT,
      input: parsed.data.messages.map(message => ({ role: message.role, content: message.content })),
      max_output_tokens: CHAT_LIMITS.maxOutputTokens,
    });
    return NextResponse.json({ message: response.output_text || "I need a little more detail about the room to continue." });
  } catch (error) {
    console.error("Room planner request failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The planner is temporarily unavailable. Your project is safe—please try again." }, { status: 502 });
  }
}
