import Stripe from 'stripe';
import {stripeKeyConfigured,stripeLive} from './stripe-mode';
import type {Queryable} from './repository';
import {grantInvoiceCredits,creditAccount,type Plan} from './credits';
export function stripeClient() {
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key || !stripeKeyConfigured())throw new Error('Billing is not configured.');
  return new Stripe(key,{timeout:15000,maxNetworkRetries:0});
}
export function pricePlan(id:string):Exclude<Plan,'free'>|null {
  return id===process.env.STRIPE_BASIC_PRICE_ID?'basic':(id===process.env.STRIPE_PRO_PRICE_ID || id===process.env.STRIPE_LEGACY_PRO_PRICE_ID)?'pro':null;
}
export async function syncSubscription(db:Queryable,stripe:Stripe,id:string) {
  const sub=await stripe.subscriptions.retrieve(id);
  const customer=typeof sub.customer==='string'?sub.customer:sub.customer.id;
  const plan=pricePlan(sub.items.data[0]?.price.id);
  if(!plan || sub.livemode!==stripeLive() || sub.items.data.length!==1) return null;
  const owner=sub.metadata.ownerId;
  const account=await db.query('SELECT id,subscription_id FROM roomwise.users WHERE id=$1 AND stripe_customer_id=$2',[owner,customer]);
  if(!account.rows[0])return null;
  const prior=account.rows[0].subscription_id;
  if(prior && prior!==id){const previous=await stripe.subscriptions.retrieve(prior);if(!['canceled','incomplete_expired'].includes(previous.status))return null;}
  const active=['active','trialing'].includes(sub.status);
  await db.query(`UPDATE roomwise.users SET plan=$3,pro_active=$4,subscription_id=$5,subscription_status=$6,billing_event_at=$7,checkout_session_id=NULL WHERE id=$1 AND stripe_customer_id=$2`,[owner,customer,active?plan:'free',active&&plan==='pro',id,sub.status,Math.floor(Date.now()/1000)]);
  return {owner,customer,plan,sub};
}
// Always verify a paid invoice and its recurring line. Checkout and webhook share
// invoice ID as the ledger key, so a redirect racing the webhook grants only once.
export async function settleInvoice(db:Queryable,stripe:Stripe,id:string) {
  const invoice=await stripe.invoices.retrieve(id);
  if(invoice.livemode!==stripeLive() || invoice.status!=='paid' || invoice.currency!=='usd')return false;
  const subscription=(invoice.parent?.subscription_details?.subscription as string|{id:string}|null);
  const subscriptionId=typeof subscription==='string'?subscription:subscription?.id;
  if(!subscriptionId || !['subscription_create','subscription_cycle','subscription_update'].includes(invoice.billing_reason||''))return false;
  const state=await syncSubscription(db,stripe,subscriptionId);
  if(!state)return false;
  const expected=state.plan==='basic'?500:5000;
  const line=invoice.lines.data.find(l=>pricePlan(l.pricing?.price_details?.price as string||'')===state.plan);
  if(!line || invoice.amount_paid!==expected || line.quantity!==1 || line.amount!==expected)return false;
  await creditAccount(db,state.owner);
  return grantInvoiceCredits(db,state.owner,invoice.id,state.plan,subscriptionId,state.customer,invoice.created);
}
