import type { Queryable } from "./repository";
import { getCad } from "./cad/store";
import { cadPlan } from "./cad/model";
import { calculateEstimate,type Artifact } from "./room-artifacts";
export async function projectAssets(db:Queryable,owner:string,id:string){
 const owned=await db.query("SELECT id,title,brief FROM roomwise.projects WHERE id=$1 AND user_id=$2",[id,owner]);if(!owned.rows.length)return null;
 const [files,photos,cad]=await Promise.all([
 db.query('SELECT id,kind,data,status,model,(image IS NOT NULL) AS "hasImage",created_at FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 30',[id,owner]),
 db.query("SELECT id,created_at FROM roomwise.photos WHERE project_id=$1 AND user_id=$2 ORDER BY created_at ASC LIMIT 12",[id,owner]),getCad(db,owner,id)]);
 const artifacts=files.rows as Artifact[];const plan=cad?cadPlan(cad.model):artifacts.find(a=>a.kind==="plan")?.data;
 for(const a of artifacts)if(a.kind==="visual"&&a.status==="running"&&!a.hasImage&&Date.now()-Date.parse(a.data.startedAt||"")>6*60*1000){a.status="failed";a.data={...a.data,generationError:"This concept was interrupted. You can retry it explicitly."};}
 for(const a of artifacts)if(a.kind==="estimate"){const geometry=plan||a.data.plan||null;a.data={...a.data,plan:geometry,...(cad?{cadRevision:cad.revision}:{}),calculations:calculateEstimate(a.data,geometry)};}
 return{project:owned.rows[0],artifacts,photos:photos.rows,hasCad:!!cad};
}
