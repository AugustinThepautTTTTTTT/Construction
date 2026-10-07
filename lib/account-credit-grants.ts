import type {Queryable} from './repository';
import {creditAccount} from './credits';
// Server-side maintenance only; there is no HTTP endpoint or client access.
export async function grantAccountCredits(db:Queryable,email:string,amount:number,operation:string){
 if(!Number.isSafeInteger(amount)||amount<1||amount>100000||!/^support:[a-zA-Z0-9:_-]{1,180}$/.test(operation))throw new Error('Invalid credit grant');
 const row=(await db.query('SELECT id FROM roomwise.users WHERE lower(email)=$1',[email.trim().toLowerCase()])).rows[0];
 if(!row)throw new Error('Account not found');
 await creditAccount(db,row.id);
 const result=await db.query(`WITH locked AS (SELECT id FROM roomwise.users WHERE id=$1 FOR UPDATE), granted AS (
  INSERT INTO roomwise.credit_ledger(operation_key,user_id,delta,kind,description)
  SELECT $2,id,$3,'grant','Account credit top-up' FROM locked ON CONFLICT DO NOTHING RETURNING user_id,delta
 ) UPDATE roomwise.users u SET credits=u.credits+g.delta FROM granted g WHERE u.id=g.user_id RETURNING u.credits`,[row.id,operation,amount]);
 const entry=(await db.query('SELECT user_id,delta FROM roomwise.credit_ledger WHERE operation_key=$1',[operation])).rows[0];
 if(entry?.user_id!==row.id||entry.delta!==amount)throw new Error('Credit grant operation already belongs to a different request');
 const current=await creditAccount(db,row.id);
 return {applied:!!result.rows.length,credits:current.credits,plan:current.plan};
}
