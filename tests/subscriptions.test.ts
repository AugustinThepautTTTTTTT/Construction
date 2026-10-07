import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {SCHEMA} from '../lib/repository';
import {creditAccount} from '../lib/credits';
import {settleInvoice} from '../lib/subscriptions';
test('verified recurring invoice credits are idempotent and cancelled subscriptions cannot be reactivated by delayed invoices',async()=>{
 const old=process.env.STRIPE_BASIC_PRICE_ID;process.env.STRIPE_BASIC_PRICE_ID='price_basic';const db=new PGlite(),owner=randomUUID();await db.exec(SCHEMA);await db.query('INSERT INTO roomwise.users(id,email,stripe_customer_id) VALUES($1,$2,$3)',[owner,'billing@test.com','cus_owned']);await creditAccount(db as any,owner);
 let status='active',amount=500,invoiceId='in_once',linePrice='price_basic';const stripe:any={subscriptions:{retrieve:async()=>({id:'sub_owned',customer:'cus_owned',livemode:false,status,metadata:{ownerId:owner},items:{data:[{price:{id:'price_basic'}}]}})},invoices:{retrieve:async()=>({id:invoiceId,livemode:false,status:'paid',currency:'usd',amount_paid:amount,billing_reason:'subscription_cycle',created:100,parent:{subscription_details:{subscription:'sub_owned'}},lines:{data:[{amount:500,quantity:1,pricing:{price_details:{price:linePrice}}}]}})}};
 assert.equal(await settleInvoice(db as any,stripe,'in_once'),true);assert.equal(await settleInvoice(db as any,stripe,'in_once'),false);assert.equal((await creditAccount(db as any,owner)).credits,40);
 invoiceId='in_bad';amount=1;assert.equal(await settleInvoice(db as any,stripe,'in_bad'),false);assert.equal((await creditAccount(db as any,owner)).credits,40);
 amount=500;linePrice='price_foreign';assert.equal(await settleInvoice(db as any,stripe,'in_bad'),false);
 linePrice='price_basic';status='canceled';invoiceId='in_late';assert.equal(await settleInvoice(db as any,stripe,'in_late'),true);const current=await creditAccount(db as any,owner);assert.equal(current.plan,'free');assert.equal(current.credits,70);
 if(old===undefined)delete process.env.STRIPE_BASIC_PRICE_ID;else process.env.STRIPE_BASIC_PRICE_ID=old;await db.close();
});
