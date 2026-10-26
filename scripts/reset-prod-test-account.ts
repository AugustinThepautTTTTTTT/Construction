import { Pool } from 'pg';

async function main(){
  if(process.env.VERCEL_ENV!=='production'||process.env.VERCEL_GIT_COMMIT_REF!=='prod') throw new Error('Refusing to execute outside production.');
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error('Production DATABASE_URL missing.');
  const db=new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000});
  const c=await db.connect();
  try {
    await c.query('BEGIN');
    const email='louisthepautwimmer1@gmail.com';
    const r=await c.query('SELECT id,subscription_id,stripe_customer_id,pro_active,plan,subscription_status FROM roomwise.users WHERE lower(email)=$1 FOR UPDATE',[email]);
    if(r.rowCount!==1){
      if(r.rowCount!==0) throw new Error('Unexpected account count.');
      await c.query('COMMIT');console.log('PROD ACCOUNT RESET: account already absent.');return;
    }
    const user=r.rows[0];
    if(user.subscription_id||user.stripe_customer_id||user.pro_active||user.plan!=='free'||user.subscription_status!=='none') throw new Error('Refusing to erase a billed account.');
    const paid=await c.query('SELECT count(*)::int AS n FROM roomwise.projects WHERE user_id=$1 AND paid=true',[user.id]);
    if(paid.rows[0].n!==0)throw new Error('Refusing to erase paid projects.');
    const id=user.id;
    await c.query('DELETE FROM roomwise.support_cases WHERE user_id=$1 OR project_id IN (SELECT id FROM roomwise.projects WHERE user_id=$1)',[id]);
    await c.query('DELETE FROM roomwise.generations WHERE project_id IN (SELECT id FROM roomwise.projects WHERE user_id=$1)',[id]);
    await c.query('DELETE FROM roomwise.cad_revisions WHERE project_id IN (SELECT id FROM roomwise.projects WHERE user_id=$1)',[id]);
    await c.query('DELETE FROM roomwise.cad_models WHERE project_id IN (SELECT id FROM roomwise.projects WHERE user_id=$1)',[id]);
    await c.query('DELETE FROM roomwise.photos WHERE user_id=$1 OR project_id IN (SELECT id FROM roomwise.projects WHERE user_id=$1)',[id]);
    await c.query('DELETE FROM roomwise.artifacts WHERE user_id=$1 OR project_id IN (SELECT id FROM roomwise.projects WHERE user_id=$1)',[id]);
    await c.query('DELETE FROM roomwise.free_trials WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.credit_ledger WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.projects WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.project_folders WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.free_credit_claims WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.sessions WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.email_verifications WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.email_outbox WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.password_resets WHERE user_id=$1',[id]);
    await c.query('DELETE FROM roomwise.magic_links WHERE email=$1 OR guest_id=$2',[email,id]);
    const deleted=await c.query('DELETE FROM roomwise.users WHERE id=$1 RETURNING id',[id]);
    if(deleted.rowCount!==1)throw new Error('Account removal failed.');
    await c.query('COMMIT');
    console.log('PROD ACCOUNT RESET: removed 1 unbilled test account and linked production records.');
  }catch(e){await c.query('ROLLBACK');throw e;}
  finally{c.release();await db.end();}
}
main().catch(()=>{console.error('PROD ACCOUNT RESET failed; no changes committed.');process.exitCode=1;});
