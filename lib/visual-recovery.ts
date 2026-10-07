import type { Queryable } from './repository';
import { IMAGE_RESERVATION_CENTS, ROOM_IMAGE_MODEL } from './room-visual';
export class VisualSourceError extends Error {}
export function bindVisualPhoto(args: unknown, photoIds: string[]) {
  if (!photoIds.length) throw new VisualSourceError('Upload an original room photo to create a visual.');
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new VisualSourceError('Provide the visual brief and an available original room photo.');
  const visual = args as Record<string, unknown>;
  if (photoIds.length === 1) return {...visual, sourcePhotoId: photoIds[0]};
  if (!photoIds.includes(visual.sourcePhotoId as string)) throw new VisualSourceError('Choose one of the available original room photos using its exact ID. The uploaded photos are still available.');
  return visual;
}
// Standard Sunburst rates, with all input charged at the higher image rate,
// no cached-input discount, and a 10% margin. Unknown usage stays reserved.
export function imageChargeCents(usage: unknown): number | null {
  if (!usage || typeof usage !== 'object') return null;
  const {input_tokens, output_tokens} = usage as Record<string, unknown>;
  if (typeof input_tokens !== 'number' || typeof output_tokens !== 'number' || !Number.isSafeInteger(input_tokens) || !Number.isSafeInteger(output_tokens) || input_tokens < 0 || output_tokens < 0) return null;
  return Math.ceil(1.1 * (input_tokens * 8 + output_tokens * 30) / 10000);
}
export async function reconcileImageBudget(db: Queryable, owner: string, id: string): Promise<number> {
  const result = await db.query("SELECT data,model,image IS NOT NULL AS ready FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='visual'", [id, owner]);
  const image = result.rows[0];
  if (!image?.ready || image.model !== ROOM_IMAGE_MODEL || image.data.budgetChargedCents !== undefined) return 0;
  const charge = imageChargeCents(image.data.usage);
  if (charge === null || charge >= IMAGE_RESERVATION_CENTS) return 0;
  const refund = IMAGE_RESERVATION_CENTS - charge;
  const settled = await db.query(`WITH settled AS (
    UPDATE roomwise.artifacts SET data=data || $1::jsonb
    WHERE id=$2 AND user_id=$3 AND kind='visual' AND image IS NOT NULL AND model=$4
      AND NOT (data ? 'budgetChargedCents') AND EXISTS(SELECT 1 FROM roomwise.ai_budget WHERE id='poc')
    RETURNING id
  ) UPDATE roomwise.ai_budget SET reserved_cents=GREATEST(0,reserved_cents-$5)
    WHERE id='poc' AND EXISTS(SELECT 1 FROM settled) RETURNING reserved_cents`,
    [JSON.stringify({budgetChargedCents:charge,budgetReservationCents:IMAGE_RESERVATION_CENTS,budgetSettledAt:new Date().toISOString()}),id,owner,ROOM_IMAGE_MODEL,refund]);
  return settled.rows.length ? refund : 0;
}
