import type { Message } from "./domain";
import type { Queryable } from "./repository";
export const LUNA_MODEL = "gpt-6-luna";
// Conservative reservation per Luna pass: bounded text/history and 6,000 output tokens,
// standard Luna pricing. No retries or refunds after ambiguous failures.
// Image edits reserve 50 cents; bounded price research reserves 20 cents.
// The 5-cent allowance greatly exceeds the documented cost of a bounded call.
export const AI_CALL_CENTS = 5;
const MAX_INPUT_BYTES = 65536;
export function aiPolicy(
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
) {
  const limit = Number(env.OPENAI_BUDGET_CENTS);
  const expiry = Date.parse(env.OPENAI_EXPIRES_AT || "");
  if (
    !env.OPENAI_API_KEY ||
    env.OPENAI_MODEL !== LUNA_MODEL ||
    !Number.isSafeInteger(limit) ||
    limit < AI_CALL_CENTS ||
    !Number.isFinite(expiry) ||
    now >= expiry
  )
    return null;
  return { model: LUNA_MODEL, limitCents: Math.min(limit, 500) };
}
export function boundedInput(
  instructions: string,
  history: Message[],
  message: string,
) {
  const input: Message[] = [
    ...history
      .filter((m) => m.status !== "failed" && m.status !== "running")
      .slice(-22)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];
  const bytes = () =>
    Buffer.byteLength(instructions) +
    Buffer.byteLength(JSON.stringify(input)) +
    4096;
  while (bytes() > MAX_INPUT_BYTES && input.length > 1) input.shift();
  if (bytes() > MAX_INPUT_BYTES) throw new Error("Room context is too long.");
  return input;
}
export async function reserveAiCall(
  db: Queryable,
  limitCents: number,
  reservationCents = AI_CALL_CENTS,
) {
  if (
    !Number.isSafeInteger(reservationCents) ||
    reservationCents < AI_CALL_CENTS ||
    reservationCents > 100 ||
    !Number.isSafeInteger(limitCents) ||
    limitCents < reservationCents
  )
    return false;
  const limit = Math.min(limitCents, 500);
  await db.query(
    "INSERT INTO roomwise.ai_budget(id,limit_cents,reserved_cents) VALUES('poc', $1, 0) ON CONFLICT(id) DO NOTHING",
    [limit],
  );
  const r = await db.query(
    "UPDATE roomwise.ai_budget SET reserved_cents=reserved_cents+$1,limit_cents=LEAST(limit_cents,$2) WHERE id='poc' AND reserved_cents+$1<=LEAST(limit_cents,$2) RETURNING reserved_cents",
    [reservationCents, limit],
  );
  return r.rows.length === 1;
}
