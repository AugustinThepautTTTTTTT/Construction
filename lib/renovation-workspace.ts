import {z} from "zod";
import type {Queryable} from "./repository";
const field=z.string().trim().min(1).max(140);
export const measurement=z.object({id:z.string().uuid(),label:field,zone:z.string().max(100),value:z.number().positive().max(100000).nullable(),unit:z.enum(["mm","cm","m","m²"]),confidence:z.enum(["estimated","measured","verified"]),notes:z.string().max(700),photoId:z.string().uuid().nullable()}).strict();
export const decision=z.object({id:z.string().uuid(),label:field,details:z.string().max(1000),status:z.enum(["proposed","confirmed","rejected"]),element:z.string().max(120),updatedAt:z.string().max(60)}).strict();
export const purchase=z.object({status:z.enum(["suggested","needs_measurements","ready","purchased","owned"]),store:z.string().max(100),actualCost:z.number().min(0).max(1000000).nullable(),notes:z.string().max(500)}).strict();
export const downtime=z.object({fixture:z.enum(["wc","shower","basin","whole_room"]),description:z.string().max(300),durationHours:z.number().min(0).max(1000).nullable()}).strict();
export const workspaceSchema=z.object({measurements:z.array(measurement).max(120),decisions:z.array(decision).max(120),purchases:z.record(z.string().max(100),purchase),downtime:z.record(z.string().max(100),downtime),review:z.object({shopping:z.string().max(250).nullable(),construction:z.string().max(250).nullable()}).strict().default({shopping:null,construction:null}),keepRoomUsable:z.boolean()}).strict();
export type Workspace=z.infer<typeof workspaceSchema>;
export const emptyWorkspace:Workspace={measurements:[],decisions:[],purchases:{},downtime:{},review:{shopping:null,construction:null},keepRoomUsable:true};
export const changeSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("measurement"),value:measurement}).strict(),
 z.object({action:z.literal("remove_measurement"),id:z.string().uuid()}).strict(),
 z.object({action:z.literal("decision"),value:decision}).strict(),
 z.object({action:z.literal("remove_decision"),id:z.string().uuid()}).strict(),
 z.object({action:z.literal("purchase"),key:z.string().max(100).min(1),value:purchase}).strict(),
 z.object({action:z.literal("downtime"),key:z.string().max(100).min(1),value:downtime}).strict(),
 z.object({action:z.literal("usability"),value:z.boolean()}).strict(),
 z.object({action:z.literal("acknowledge_review"),target:z.enum(["shopping","construction"])}).strict(),
 z.object({action:z.literal("undo")}).strict()
]);
export type WorkspaceChange=z.infer<typeof changeSchema>;
export function applyWorkspaceChange(state:Workspace,change:WorkspaceChange):Workspace {
 switch(change.action){
  case "measurement":return {...state,measurements:[...state.measurements.filter(x=>x.id!==change.value.id),change.value],review:{shopping:"Site measurements changed — verify dimensions, quantities and product compatibility.",construction:"Site measurements changed — verify installation steps and clearances."}};
  case "remove_measurement":return {...state,measurements:state.measurements.filter(x=>x.id!==change.id),review:{shopping:"A measurement was removed — confirm affected quantities.",construction:"A measurement was removed — verify work instructions."}};
  case "decision":return {...state,decisions:[...state.decisions.filter(x=>x.id!==change.value.id),change.value],review:change.value.status==="confirmed"?{shopping:"A design decision was confirmed — review shopping requirements.",construction:"A design decision was confirmed — review work sequence and scope."}:state.review};
  case "remove_decision":return {...state,decisions:state.decisions.filter(x=>x.id!==change.id)};
  case "purchase":return {...state,purchases:{...state.purchases,[change.key]:change.value}};
  case "downtime":return {...state,downtime:{...state.downtime,[change.key]:change.value}};
  case "usability":return {...state,keepRoomUsable:change.value,review:{...state.review,construction:"Room availability preferences changed — review fixture downtime."}};
  case "acknowledge_review":return {...state,review:{...state.review,[change.target]:null}};
  case "undo":return state;
 }
}
export async function loadWorkspace(db:Queryable,owner:string,projectId:string){
 const row=await db.query("SELECT state,revision FROM roomwise.renovation_workspaces WHERE project_id=$1 AND user_id=$2",[projectId,owner]);
 return row.rows[0]?{state:workspaceSchema.parse(row.rows[0].state),revision:Number(row.rows[0].revision)}:{state:emptyWorkspace,revision:0};
}
export async function changeWorkspace(db:Queryable,owner:string,projectId:string,raw:unknown,revision:number){
 const change=changeSchema.parse(raw);
 if(!Number.isSafeInteger(revision)||revision<0)throw new Error("Invalid revision");
 const exists=await db.query("SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",[projectId,owner]);
 if(!exists.rows.length)throw new Error("Project not found");
 const old=await loadWorkspace(db,owner,projectId);
 if(old.revision!==revision)throw new Error("Workspace changed. Refresh before saving.");
 if(change.action==="undo"){
  const prior=await db.query("SELECT previous_state FROM roomwise.renovation_workspace_events WHERE project_id=$1 AND user_id=$2 ORDER BY revision DESC LIMIT 1",[projectId,owner]);
  if(!prior.rows.length)return old;
  const reverted=workspaceSchema.parse(prior.rows[0].previous_state);
  return saveWorkspace(db,owner,projectId,old,reverted,change);
 }
 const next=workspaceSchema.parse(applyWorkspaceChange(old.state,change));
 return saveWorkspace(db,owner,projectId,old,next,change);
}
async function saveWorkspace(db:Queryable,owner:string,projectId:string,old:{state:Workspace;revision:number},next:Workspace,change:WorkspaceChange){
 const result=await db.query(`INSERT INTO roomwise.renovation_workspaces(project_id,user_id,state,revision) SELECT id,user_id,$3::jsonb,1 FROM roomwise.projects WHERE id=$1 AND user_id=$2 AND $4=0 ON CONFLICT(project_id) DO UPDATE SET state=EXCLUDED.state,revision=roomwise.renovation_workspaces.revision+1,updated_at=now() WHERE roomwise.renovation_workspaces.user_id=$2 AND roomwise.renovation_workspaces.revision=$4 RETURNING revision`,[projectId,owner,JSON.stringify(next),old.revision]);
 if(!result.rows.length)throw new Error("Workspace changed. Refresh before saving.");
 const updated=Number(result.rows[0].revision);
 await db.query("INSERT INTO roomwise.renovation_workspace_events(project_id,user_id,revision,previous_state,change) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)",[projectId,owner,updated,JSON.stringify(old.state),JSON.stringify(change)]);
 return {state:next,revision:updated};
}
export function purchaseKey(estimateId:string,index:number){return `${estimateId}:${index}`;}
export function shoppingReadiness(status:Workspace["purchases"][string]["status"]|undefined,quantityConfirmed:boolean){return status|| (quantityConfirmed?"ready":"needs_measurements");}
