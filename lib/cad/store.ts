import type { Queryable } from "../repository";
import { validateCad, type CadDocument, type RoomCad } from "./model";
export class CadConflict extends Error {constructor(readonly current:CadDocument|null){super("The room model changed. Review the latest version before saving.");}}
function document(row:any):CadDocument {return {projectId:row.project_id,revision:row.revision,model:row.model,updated_at:new Date(row.updated_at).toISOString(),author:row.author,summary:row.summary};}
export async function getCad(db:Queryable,owner:string,projectId:string){
 const r=await db.query("SELECT c.* FROM roomwise.cad_models c JOIN roomwise.projects p ON p.id=c.project_id WHERE c.project_id=$1 AND p.user_id=$2",[projectId,owner]);return r.rows[0]?document(r.rows[0]):null;
}
export async function saveCad(db:Queryable,owner:string,projectId:string,baseRevision:number,raw:unknown,author:"ai"|"user",summary:string){
 const model=validateCad(raw);
 if(!Number.isSafeInteger(baseRevision)||baseRevision<0)throw new Error("Invalid base revision.");
 const owned=await db.query("SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",[projectId,owner]);if(!owned.rows.length)throw new Error("Room not found.");
 // One SQL statement updates combined model and history; compare-and-swap rejects stale edits.
 const result=await db.query(`WITH saved AS (
 INSERT INTO roomwise.cad_models(project_id,revision,model,author,summary)
 SELECT $1,1,$3::jsonb,$4,$5 WHERE $2=0
 ON CONFLICT(project_id) DO UPDATE SET revision=roomwise.cad_models.revision+1,model=$3::jsonb,author=$4,summary=$5,updated_at=now() WHERE roomwise.cad_models.revision=$2
 RETURNING *
 ), updated AS (
 UPDATE roomwise.cad_models SET revision=revision+1,model=$3::jsonb,author=$4,summary=$5,updated_at=now()
 WHERE project_id=$1 AND revision=$2 AND $2>0 RETURNING *
 ), combined AS (SELECT * FROM saved UNION ALL SELECT * FROM updated), logged AS (
 INSERT INTO roomwise.cad_revisions(project_id,revision,model,author,summary) SELECT project_id,revision,model,author,summary FROM combined RETURNING revision
 ) SELECT combined.* FROM combined JOIN logged USING(revision)`,[projectId,baseRevision,JSON.stringify(model),author,summary.slice(0,240)]);
 if(!result.rows.length)throw new CadConflict(await getCad(db,owner,projectId));
 await db.query("UPDATE roomwise.projects SET updated_at=now() WHERE id=$1 AND user_id=$2",[projectId,owner]);
 return document(result.rows[0]);
}
export async function cadHistory(db:Queryable,owner:string,projectId:string){const r=await db.query("SELECT r.revision,r.author,r.summary,r.created_at FROM roomwise.cad_revisions r JOIN roomwise.projects p ON p.id=r.project_id WHERE r.project_id=$1 AND p.user_id=$2 ORDER BY r.revision DESC LIMIT 30",[projectId,owner]);return r.rows;}
export async function cadAtRevision(db:Queryable,owner:string,projectId:string,revision:number):Promise<RoomCad|null>{const r=await db.query("SELECT r.model FROM roomwise.cad_revisions r JOIN roomwise.projects p ON p.id=r.project_id WHERE r.project_id=$1 AND r.revision=$2 AND p.user_id=$3",[projectId,revision,owner]);return r.rows[0]?.model||null;}
