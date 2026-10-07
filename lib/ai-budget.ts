import type { Message } from "./domain";
import type { Queryable } from "./repository";
export const LUNA_MODEL = "gpt-6-luna";
// Legacy PoC reservation helpers are retained for historical accounting only.
// Active chat, image and search flows use the per-account credit ledger.
export const AI_CALL_CENTS = 5;
export const POC_MAX_CENTS = 1000;
const MAX_INPUT_BYTES = 65536;
export function aiPolicy(
  env: Record<string, string | undefined> = process.env,
  _now = Date.now(),
) {
  if (!env.OPENAI_API_KEY || env.OPENAI_MODEL !== LUNA_MODEL) return null;
  return { model: LUNA_MODEL, limitCents: POC_MAX_CENTS };
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
    reservationCents < 1 ||
    reservationCents > 100 ||
    !Number.isSafeInteger(limitCents) ||
    limitCents < reservationCents
  )
    return false;
  const limit = Math.min(limitCents, POC_MAX_CENTS);
  await db.query(
    "INSERT INTO roomwise.ai_budget(id,limit_cents,reserved_cents) VALUES('poc', $1, 0) ON CONFLICT(id) DO NOTHING",
    [limit],
  );
  const r = await db.query(
    "UPDATE roomwise.ai_budget SET reserved_cents=reserved_cents+$1,limit_cents=$2 WHERE id='poc' AND reserved_cents+$1<=$2 RETURNING reserved_cents",
    [reservationCents, limit],
  );
  return r.rows.length === 1;
}
