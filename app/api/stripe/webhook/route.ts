import {NextRequest,NextResponse} from 'next/server';
import {database} from '@/lib/database';
import {verifyTestEvent} from '@/lib/stripe-events';
import {stripeClient,settleInvoice,syncSubscription} from '@/lib/subscriptions';
import {error} from '@/lib/server';
import {queueMail,flushMail,mailConfigured} from '@/lib/mail';
export const runtime='nodejs';
export async function POST(r:NextRequest){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret)return error('Webhook is not configured.');
 let event;try{event=verifyTestEvent(await r.text(),r.headers.get('stripe-signature')||'',secret);}catch{return error('Invalid webhook signature.',400);}
 const db=await database();if(!db)return error('Payment persistence is unavailable.');
 try{const stripe=stripeClient(),object=event.data.object as any;
 if(['invoice.paid','invoice.payment_succeeded'].includes(event.type)){
  await settleInvoice(db,stripe,object.id);
  const owner=await db.query("SELECT user_id FROM roomwise.credit_ledger WHERE operation_key=$1",['invoice:'+object.id]);
  if(owner.rows[0]){await queueMail(db,'invoice:'+object.id,owner.rows[0].user_id,'Your Archicova credits are ready',`Your monthly payment is confirmed. Your credits have been added to your account. Open your workspace: ${process.env.NEXT_PUBLIC_APP_URL}/chat\nManage your subscription in Settings → Plan & billing.`);if(mailConfigured()&&!await flushMail(db,'invoice:'+object.id))throw new Error('Email retry required');}
 }else if(event.type.startsWith('customer.subscription.')){await syncSubscription(db,stripe,object.id);}
 else if(event.type==='checkout.session.completed'&&object.invoice){await settleInvoice(db,stripe,typeof object.invoice==='string'?object.invoice:object.invoice.id);}
 return NextResponse.json({received:true});
 }catch{return error('Payment event could not be saved. Stripe will retry.');}
}
