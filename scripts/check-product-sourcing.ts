import { reconcileImageBudget } from "../lib/visual-recovery";
// Reconcile confirmed image usage and report private-safe diagnostics only.
// Builds never perform product research or new paid AI calls.
import { database } from "../lib/database";
import { aiPolicy } from "../lib/ai-budget";
async function main(){
 if(process.env.VERCEL!=="1"||!aiPolicy())return;
 const testers=(process.env.ROOMWISE_TESTER_EMAILS||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!testers.length)return;
 const db=await database();if(!db)return;
 try{
  const completed=await db.query("SELECT a.id,a.user_id FROM roomwise.artifacts a JOIN roomwise.users u ON u.id=a.user_id WHERE lower(u.email)=ANY($1::text[]) AND a.kind='visual' AND a.image IS NOT NULL AND a.model='gpt-image-2.5-sunburst' AND NOT (a.data ? 'budgetChargedCents')",[testers]);
  let releasedCents=0;
  for(const image of completed.rows)releasedCents+=await reconcileImageBudget(db,image.user_id,image.id);
  console.info("Roomwise confirmed image settlement",{releasedCents});
  const rooms=await db.query("SELECT p.id,p.user_id,p.messages,(SELECT count(*)::int FROM roomwise.artifacts a WHERE a.project_id=p.id AND a.user_id=p.user_id) AS deliverables,(SELECT count(*)::int FROM roomwise.photos ph WHERE ph.project_id=p.id AND ph.user_id=p.user_id) AS photos,(SELECT count(*)::int FROM roomwise.artifacts a WHERE a.project_id=p.id AND a.kind='visual' AND a.image IS NOT NULL) AS images FROM roomwise.projects p JOIN roomwise.users u ON u.id=p.user_id WHERE lower(u.email)=ANY($1::text[]) ORDER BY p.updated_at DESC LIMIT 1",[testers]);
  const room=rooms.rows[0];
  if(room){
    const references=room.messages.filter((message:any)=>message.role==="user"&&message.photoIds?.length).at(-1)?.photoIds||[];
    const available=await db.query("SELECT count(*)::int AS n FROM roomwise.photos WHERE id=ANY($1::uuid[]) AND project_id=$2 AND user_id=$3",[references,room.id,room.user_id]);
    const budget=await db.query("SELECT limit_cents,reserved_cents FROM roomwise.ai_budget WHERE id='poc'");
    console.info("Roomwise visual preparation diagnostics",{deliverables:room.deliverables,storedPhotos:room.photos,photoReferences:references.length,availableReferences:available.rows[0].n,completedImages:room.images,budget:budget.rows[0]});
  }
 }catch(e){const failure=e as {status?:number;code?:string;param?:string};console.warn("Roomwise live sourcing check unavailable",{status:failure.status,code:failure.code,param:failure.param});}
 finally{await db.end();}
}
main().catch(()=>{console.warn("Roomwise sourcing upgrade could not run.");process.exitCode=0;});
