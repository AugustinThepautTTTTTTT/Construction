import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {SCHEMA} from '../lib/repository';
import {queueMail,flushMail,transactionalHtml} from '../lib/mail';

test('transactional emails retry failures, recover interrupted sends and do not repeat completed deliveries',async()=>{
 const before={EMAIL_FROM:process.env.EMAIL_FROM,RESEND_API_KEY:process.env.RESEND_API_KEY,SMTP_URL:process.env.SMTP_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL};
 const originalFetch=globalThis.fetch,db=new PGlite(),owner=randomUUID();let calls=0,success=false;
 try{
  await db.exec(SCHEMA);await db.query('INSERT INTO roomwise.users(id,email) VALUES($1,$2)',[owner,'mail@example.com']);
  process.env.EMAIL_FROM='Roomwise <hello@example.com>';process.env.RESEND_API_KEY='test';delete process.env.SMTP_URL;process.env.NEXT_PUBLIC_APP_URL='https://roomwise.example';
  globalThis.fetch=async()=>{calls++;return new Response('{}',{status:success?200:500});};
  await queueMail(db as any,'invoice:test',owner,'Payment confirmed','Credits are ready');
  await queueMail(db as any,'invoice:test',owner,'Duplicate','Duplicate');
  assert.equal(await flushMail(db as any,'invoice:test'),false);success=true;
  assert.equal(await flushMail(db as any,'invoice:test'),true);assert.equal(await flushMail(db as any,'invoice:test'),true);assert.equal(calls,2);
  await queueMail(db as any,'interrupted',owner,'Retry','Retry');
  await db.query("UPDATE roomwise.email_outbox SET status='sending',attempted_at=now()-interval '10 minutes' WHERE id='interrupted'");
  assert.equal(await flushMail(db as any,'interrupted'),true);assert.equal(calls,3);
 }finally{
  globalThis.fetch=originalFetch;for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await db.close();
 }
});

test('branded mail safely escapes content and keeps secure actions on the configured domain',()=>{
 const before=process.env.NEXT_PUBLIC_APP_URL;
 try{
  process.env.NEXT_PUBLIC_APP_URL='https://archicova.com';
  const html=transactionalHtml('Reset your Archicova password','Reset here: https://archicova.com/account?reset=abc123\n<script>alert(1)</script>');
  assert.match(html,/Archicova/);
  assert.match(html,/Reset password/);
  assert.match(html,/href="https:\/\/archicova.com\/account\?reset=abc123"/);
  assert.doesNotMatch(html,/<script>alert/);
  assert.match(html,/&lt;script&gt;/);
  const unrelated=transactionalHtml('Reset your Archicova password','Visit https://not-archicova.example/account');
  assert.doesNotMatch(unrelated,/display:inline-block;padding:15px 23px/);
 }finally{if(before===undefined)delete process.env.NEXT_PUBLIC_APP_URL;else process.env.NEXT_PUBLIC_APP_URL=before;}
});
