import type { Queryable } from './repository';
export type Plan = 'free' | 'basic' | 'pro';
export const PLANS = {
  free: { name: 'Free', credits: 10, monthly: 0 },
  basic: { name: 'Basic', credits: 30, monthly: 5 },
  pro: { name: 'Pro', credits: 350, monthly: 50 },
} as const;
export const CREDIT_COST = { message: 1, image: 2, search: 4 } as const;
export class CreditError extends Error {
  constructor(message = 'You’re out of credits. Upgrade your plan to keep creating.', readonly code = 'CREDITS_EXHAUSTED') { super(message); }
}
export async function creditAccount(db: Queryable, owner: string) {
  await db.query(`WITH locked AS (
    SELECT id,plan,email FROM roomwise.users WHERE id=$1 AND email IS NOT NULL AND credits_initialized=false FOR UPDATE
  ), claim AS (
    INSERT INTO roomwise.free_credit_claims(email_key,user_id)
    SELECT CASE WHEN split_part(lower(email),'@',2) IN ('gmail.com','googlemail.com')
      THEN replace(split_part(split_part(lower(email),'@',1),'+',1),'.','')||'@gmail.com'
      ELSE lower(email) END,id FROM locked WHERE plan='free'
    ON CONFLICT DO NOTHING RETURNING user_id
  ), granted AS (
    INSERT INTO roomwise.credit_ledger(operation_key,user_id,delta,kind,description)
    SELECT 'welcome:'||id,id,CASE plan WHEN 'pro' THEN 350 WHEN 'basic' THEN 30 ELSE 10 END,'grant','Welcome credits' FROM locked
    WHERE plan<>'free' OR id IN (SELECT user_id FROM claim)
    ON CONFLICT DO NOTHING RETURNING user_id,delta
  ) UPDATE roomwise.users u SET credits=u.credits+COALESCE(g.delta,0),credits_initialized=true FROM locked l LEFT JOIN granted g ON g.user_id=l.id WHERE u.id=l.id`, [owner]);
  const r = await db.query('SELECT plan,credits,subscription_id,subscription_status FROM roomwise.users WHERE id=$1 AND email IS NOT NULL', [owner]);
  if (!r.rows[0]) throw new CreditError('Create an account to start your project.', 'SIGN_IN');
  return r.rows[0] as {plan:Plan;credits:number;subscription_id:string|null;subscription_status:string};
}
export async function requirePaid(db: Queryable, owner: string) {
  const account = await creditAccount(db, owner);
  if (account.plan === 'free') throw new CreditError('Bills of materials and work plans are included in Basic and Pro. Upgrade to turn your idea into an implementation plan.', 'PLAN_REQUIRED');
  return account;
}
export async function debitCredits(db: Queryable, owner: string, operation: string, kind: keyof typeof CREDIT_COST, project?: string) {
  await creditAccount(db, owner);
  const cost = CREDIT_COST[kind];
  const r = await db.query(`WITH locked AS (SELECT id,credits FROM roomwise.users WHERE id=$1 FOR UPDATE), charged AS (
    INSERT INTO roomwise.credit_ledger(operation_key,user_id,project_id,delta,kind,description)
    SELECT $2,id,$3,-$4::integer,$5,$6 FROM locked WHERE credits >= $4
    ON CONFLICT DO NOTHING RETURNING user_id,delta
  ) UPDATE roomwise.users u SET credits=u.credits+c.delta FROM charged c WHERE u.id=c.user_id RETURNING u.credits`, [owner,operation,project||null,cost,kind,kind==='search'?'Product search':kind==='image'?'Concept image':'Chat message']);
  if (r.rows[0]) return r.rows[0].credits as number;
  const existing = await db.query('SELECT delta FROM roomwise.credit_ledger WHERE operation_key=$1 AND user_id=$2', [operation,owner]);
  if (existing.rows[0]?.delta === -cost) return (await creditAccount(db, owner)).credits;
  throw new CreditError();
}
export async function refundCredits(db:Queryable, owner:string, operation:string) {
  await db.query(`WITH refunded AS (
    INSERT INTO roomwise.credit_ledger(operation_key,user_id,project_id,delta,kind,description)
    SELECT 'refund:'||operation_key,user_id,project_id,-delta,'refund','Generation could not finish' FROM roomwise.credit_ledger WHERE operation_key=$1 AND user_id=$2 AND delta<0
    ON CONFLICT DO NOTHING RETURNING user_id,delta
  ) UPDATE roomwise.users u SET credits=u.credits+r.delta FROM refunded r WHERE u.id=r.user_id`,[operation,owner]);
}
export async function grantInvoiceCredits(db:Queryable, owner:string, invoiceId:string, plan:Exclude<Plan,'free'>, subscription:string, customer:string, created:number) {
  const credits = PLANS[plan].credits;
  const r = await db.query(`WITH locked AS (SELECT id FROM roomwise.users WHERE id=$1 AND stripe_customer_id=$2 FOR UPDATE), granted AS (
    INSERT INTO roomwise.credit_ledger(operation_key,user_id,delta,kind,description)
    SELECT 'invoice:'||$3,id,$4,'grant',$5 FROM locked ON CONFLICT DO NOTHING RETURNING user_id,delta
  ) UPDATE roomwise.users u SET credits=u.credits+g.delta,plan=CASE WHEN u.billing_event_at<=$8 THEN $6 ELSE u.plan END,subscription_id=CASE WHEN u.billing_event_at<=$8 THEN $7 ELSE u.subscription_id END,subscription_status=CASE WHEN u.billing_event_at<=$8 THEN 'active' ELSE u.subscription_status END,pro_active=CASE WHEN u.billing_event_at<=$8 THEN $6='pro' ELSE u.pro_active END,billing_event_at=GREATEST(u.billing_event_at,$8) FROM granted g WHERE u.id=g.user_id RETURNING u.id`,[owner,customer,invoiceId,credits,`${PLANS[plan].name} monthly credits`,plan,subscription,created]);
  return !!r.rows.length;
}
