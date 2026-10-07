import {randomBytes} from 'node:crypto';
import type {Queryable} from './repository';
import {digest} from './server';
import {queueMail,flushMail} from './mail';
export async function requestConfirmation(db:Queryable,user:string){
 const token=randomBytes(32).toString('hex');await db.query("INSERT INTO roomwise.email_verifications(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours')",[digest(token),user]);
 const url=new URL('/api/auth/confirmation',process.env.NEXT_PUBLIC_APP_URL||'https://construction-git-work-tests-projects-e44ed118.vercel.app');url.searchParams.set('token',token);
 const id='verify:'+digest(token);await queueMail(db,id,user,'Confirm your Archicova email',`Welcome to Archicova. Confirm your email to keep your workspace secure:\n${url}\n\nThis link expires in 24 hours. If you did not create an account, ignore this message.`);return flushMail(db,id);
}
