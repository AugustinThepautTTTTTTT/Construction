import {stripeLive} from '@/lib/stripe-mode';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {database,rateLimit} from '@/lib/database';
import {ProjectRepository} from '@/lib/repository';
import {identity,sameOrigin,error} from '@/lib/server';
import {stripeClient} from '@/lib/subscriptions';
const schema=z.object({plan:z.enum(['basic','pro']),projectId:z.string().uuid().optional()});
export async function POST(r:NextRequest){
 if(!sameOrigin(r))return error('Invalid request origin.',403);
 const parsed=schema.safeParse(await r.json().catch(()=>null));if(!parsed.success)return error('Choose Basic or Pro.',400);
 try{
  const user=await identity(r),db=await database();if(!user?.email||!db)return error('Create an account or sign in first.',401);
  if(parsed.data.projectId && !await new ProjectRepository(db).get(user.id,parsed.data.projectId))return error('Project not found.',404);
  const stripe=stripeClient();const row=(await db.query('SELECT stripe_customer_id,subscription_id FROM roomwise.users WHERE id=$1',[user.id])).rows[0];
  // Prevent parallel paid subscriptions; switching plans is handled by the portal.
  if(row.subscription_id){const sub=await stripe.subscriptions.retrieve(row.subscription_id);if(!['canceled','incomplete_expired'].includes(sub.status)){const portal=await stripe.billingPortal.sessions.create({customer:row.stripe_customer_id,configuration:process.env.STRIPE_PORTAL_CONFIGURATION_ID,return_url:r.nextUrl.origin+'/chat'});return NextResponse.json({url:portal.url});}}
  if(!await rateLimit(`checkout:${user.id}`,10,3600))return error('Please wait before trying checkout again.',429);
  const price=parsed.data.plan==='basic'?process.env.STRIPE_BASIC_PRICE_ID:process.env.STRIPE_PRO_PRICE_ID;
  if(!price||!process.env.STRIPE_WEBHOOK_SECRET)return error('This subscription is temporarily unavailable.');
  const p=await stripe.prices.retrieve(price);if(p.livemode!==stripeLive()||!p.active||p.currency!=='usd'||p.unit_amount!==(parsed.data.plan==='basic'?500:5000)||p.recurring?.interval!=='month')throw new Error('Invalid price');
  let customer=row.stripe_customer_id;
  if(!customer){const created=await stripe.customers.create({email:user.email,metadata:{roomwise_user_id:user.id}},{idempotencyKey:`roomwise-customer-${user.id}`});customer=(await db.query('UPDATE roomwise.users SET stripe_customer_id=COALESCE(stripe_customer_id,$1) WHERE id=$2 RETURNING stripe_customer_id',[created.id,user.id])).rows[0].stripe_customer_id;}
  const project=parsed.data.projectId?`project=${parsed.data.projectId}&`:'';
  // Serialize checkout creation, including across different selected plans.
  // A completed checkout blocks a second subscription even before its webhook.
  const c=await db.connect();
  try{
   await c.query('BEGIN');
   const locked=(await c.query('SELECT checkout_session_id FROM roomwise.users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   if(locked.checkout_session_id){
    const previous=await stripe.checkout.sessions.retrieve(locked.checkout_session_id);
    if(previous.status==='complete'){await c.query('COMMIT');return error('Your payment is being confirmed. Return to your workspace before starting another checkout.',409);}
    if(previous.status==='open'&&previous.url){await c.query('COMMIT');return NextResponse.json({url:previous.url});}
   }
   const session=await stripe.checkout.sessions.create({mode:'subscription',customer,line_items:[{price,quantity:1}],client_reference_id:user.id,metadata:{ownerId:user.id,plan:parsed.data.plan},subscription_data:{metadata:{ownerId:user.id,plan:parsed.data.plan}},success_url:`${r.nextUrl.origin}/chat?${project}checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${r.nextUrl.origin}/chat?${project}checkout=cancelled`});
   await c.query('UPDATE roomwise.users SET checkout_session_id=$1 WHERE id=$2',[session.id,user.id]);
   await c.query('COMMIT');return NextResponse.json({url:session.url});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }catch{return error('Checkout could not be opened. Please try again.');}
}
