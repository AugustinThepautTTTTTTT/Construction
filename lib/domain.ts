import { z } from "zod";
export const briefSchema = z.object({
  room: z.enum(["Kitchen", "Bathroom", "Living room", "Bedroom", "Other"]),
  goal: z.string().trim().min(3).max(2000),
  budget: z.string().trim().max(100).default("Not set"),
  size: z.string().trim().max(100).default("Not measured"),
  market: z.object({city:z.string().max(100),country:z.string().regex(/^[A-Z]{2}$/),currency:z.string().regex(/^[A-Z]{3}$/)}).nullable().optional(),
  location: z.string().trim().max(100).default("Not specified"),
});
export type Brief = z.infer<typeof briefSchema>;
export type Message = {
  role: "user" | "assistant";
  uiAction?:boolean;
  content: string;
  photoIds?: string[];
  artifactIds?: string[];
  artifactViews?: Record<string, { type: "products"; index: number }>;
  generationId?: string;
  status?: "running" | "complete" | "failed";
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
};
export type Project = {
  id: string;
  title: string;
  folderId?: string | null;
  titleStatus?: string;
  brief: Brief;
  messages: Message[];
  paid: boolean;
  updated_at: string;
  previewUsed?: boolean;
  storage?: "browser" | "cloud";
};
export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || /[\u0000-\u0020\u007f\\]/.test(value))
    return "/chat";
  try {
    const u = new URL(value, "https://roomwise.invalid");
    return u.origin === "https://roomwise.invalid"
      ? u.pathname + u.search + u.hash
      : "/chat";
  } catch {
    return "/chat";
  }
}
export function checkoutGrant(value: unknown) {
  const parsed = z
    .object({
      livemode: z.literal(false),
      payment_status: z.literal("paid"),
      currency: z.literal("usd"),
      amount_total: z.number().int(),
      mode: z.enum(["payment", "subscription"]),
      metadata: z.object({
        plan: z.enum(["single", "pro"]),
        ownerId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    })
    .safeParse(value);
  if (!parsed.success) return null;
  const pro = parsed.data.metadata.plan === "pro";
  if (
    parsed.data.amount_total !== (pro ? 5000 : 500) ||
    parsed.data.mode !== (pro ? "subscription" : "payment")
  )
    return null;
  return parsed.data.metadata;
}
export function makePreview(b: Brief) {
  return `YOUR ${b.room.toUpperCase()} STARTER PLAN\n\nYour goal: ${b.goal}\nWorking budget: ${b.budget || "Not set"}. Room size: ${b.size || "Not measured"}. Location: ${b.location || "Not specified"}.\n\n1. Keep what already works\nList the fixtures and finishes you want to retain. Prioritise storage, circulation and lighting before decorative purchases.\n\n2. Test the layout before buying\nMeasure door swings, walkways, sockets and existing plumbing. Sketch two alternatives and compare them against your main goal.\n\n3. Protect the budget\nFor an initial planning estimate, reserve part of your stated budget for unexpected work and obtain itemised local quotes before committing. Product and labour prices have not been checked.\n\n4. Sequence the work\nConfirm dimensions → validate technical work → order materials → complete disruptive work → install finishes and furniture.\n\nAssumptions: no structural changes and existing services can remain. This is a rule-based starter preview, not an AI-generated design or a contractor quote. Electrical, plumbing and structural work need professional review.\n\nYour next decision: which matters most—layout, storage, finishes or cost?`;
}
