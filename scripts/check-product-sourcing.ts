// Repair one legacy tester bill during the upgrade, using the same ownership,
// paid entitlement, rate limits and atomic shared budget as the app. No secrets
// or room content are logged. Subsequent builds skip the completed attempt.
import { database } from "../lib/database";
import { researchMaterialPrices } from "../lib/material-research";
import { needsAutomaticProducts } from "../lib/product-search";
import { aiPolicy } from "../lib/ai-budget";
async function main(){
 if(process.env.VERCEL!=="1"||!aiPolicy())return;
 const testers=(process.env.ROOMWISE_TESTER_EMAILS||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!testers.length)return;
 const db=await database();if(!db)return;
 try{
  const result=await db.query("SELECT a.id,a.user_id,a.data FROM roomwise.artifacts a JOIN roomwise.users u ON u.id=a.user_id JOIN roomwise.projects p ON p.id=a.project_id WHERE lower(u.email)=ANY($1::text[]) AND a.kind='estimate' AND (u.pro_active OR p.paid) ORDER BY a.created_at DESC LIMIT 1",[testers]);
  const bill=result.rows[0];if(!bill||!needsAutomaticProducts(bill.data))return;
  const sources=await researchMaterialPrices(db,bill.user_id,bill.id,bill.data);
  console.info("Roomwise live sourcing check",{sourced:sources.length,items:bill.data.items.length,model:aiPolicy()?.model});
 }catch(e){const failure=e as {status?:number;code?:string;param?:string};console.warn("Roomwise live sourcing check unavailable",{status:failure.status,code:failure.code,param:failure.param});}
 finally{await db.end();}
}
main().catch(()=>{console.warn("Roomwise sourcing upgrade could not run.");process.exitCode=0;});
