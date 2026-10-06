import type { Queryable } from "./repository";
import { getCad } from "./cad/store";
import { cadPlan } from "./cad/model";
export async function projectGeometry(db:Queryable,owner:string,projectId:string){
 const cad=await getCad(db,owner,projectId);if(cad)return{plan:cadPlan(cad.model),cadRevision:cad.revision};
 const result=await db.query("SELECT data FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='plan' ORDER BY created_at DESC LIMIT 1",[projectId,owner]);
 return result.rows[0]?{plan:result.rows[0].data}:null;
}
