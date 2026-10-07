import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {database} from '@/lib/database';
import {identity,sameOrigin,error} from '@/lib/server';
import {stripeClient,settleInvoice} from '@/lib/subscriptions';
export async function POST(r:NextRequest){
 if(!sameOrigin(r))return error('Invalid request origin.',403);
 const body=z.object({sessionId:z.string().regex(/^cs_test_[A-Za-z0-9]+$/),projectId:z.string().uuid().optional()}).safeParse(await r.json().catch(()=>null));
 if(!body.success)return error('Return from your secure checkout to confirm payment.',400);
 try{const user=await identity(r),db=await database();if(!user?.email||!db)return error('Sign in first.',401);
 const stripe=stripeClient(),session=await stripe.checkout.sessions.retrieve(body.data.sessionId);const row=(await db.query('SELECT stripe_customer_id FROM roomwise.users WHERE id=$1',[user.id])).rows[0];
 if(session.livemode||session.status!=='complete'||session.payment_status!=='paid'||session.mode!=='subscription'||session.client_reference_id!==user.id||session.metadata?.ownerId!==user.id||session.customer!==row.stripe_customer_id)return NextResponse.json({confirmed:false});
 const invoice=typeof session.invoice==='string'?session.invoice:session.invoice?.id;if(!invoice)return NextResponse.json({confirmed:false});
 await settleInvoice(db,stripe,invoice);const current=await identity(r);return NextResponse.json({confirmed:current?.plan!=='free',credits:current?.credits});
 }catch{return error('Payment verification is temporarily unavailable. Please retry.');}
}
