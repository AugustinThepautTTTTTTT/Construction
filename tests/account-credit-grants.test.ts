import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {SCHEMA} from '../lib/repository';
import {creditAccount} from '../lib/credits';
import {grantAccountCredits} from '../lib/account-credit-grants';

test('a requested account top-up adds 300 credits once without resetting usage or changing the subscription',async()=>{
 const db=new PGlite(),owner=randomUUID(),other=randomUUID();
 try{
  await db.exec(SCHEMA);await db.query('INSERT INTO roomwise.users(id,email) VALUES($1,$2),($3,$4)',[owner,'owner@gmail.com',other,'other@gmail.com']);
  await creditAccount(db as any,owner);await db.query("UPDATE roomwise.users SET credits=1,plan='basic' WHERE id=$1",[owner]);
  const results=await Promise.all(Array.from({length:5},()=>grantAccountCredits(db as any,'owner@gmail.com',300,'support:owner:2026-10-07')));
  assert.equal(results.filter(r=>r.applied).length,1);
  assert.equal((await creditAccount(db as any,owner)).credits,301);
  assert.equal((await creditAccount(db as any,owner)).plan,'basic');
  assert.equal((await creditAccount(db as any,other)).credits,10);
  assert.equal((await db.query<{delta:number}>("SELECT delta FROM roomwise.credit_ledger WHERE operation_key='support:owner:2026-10-07'")).rows[0].delta,300);
  await assert.rejects(()=>grantAccountCredits(db as any,'missing@gmail.com',300,'support:missing'),/Account not found/);
  await assert.rejects(()=>grantAccountCredits(db as any,'owner@gmail.com',-1,'support:bad'),/Invalid credit grant/);
 }finally{await db.close();}
});
