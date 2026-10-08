import {z} from 'zod';
import type {Queryable} from './repository';
const lines=z.array(z.string().trim().min(1).max(800)).min(1).max(8);
export const workUpdateSchema=z.object({planId:z.string().uuid(),expectedRevision:z.number().int().min(0),index:z.number().int().min(0).max(19),checked:z.boolean().nullable(),instructions:lines.nullable(),checks:z.array(z.string().trim().min(1).max(800)).max(6).nullable(),note:z.string().max(500)}).strict().refine(value=>value.checked!==null||value.instructions!==null||value.checks!==null);
type WorkEdit=Pick<z.infer<typeof workUpdateSchema>,'index'|'checked'|'instructions'|'checks'|'note'>;
export function applyWorkUpdate(data:any,edit:WorkEdit){
 if(!data.steps?.[edit.index])throw Error('Work step not found.');
 const steps=data.steps.map((step:any,index:number)=>index===edit.index?{...step,...(edit.instructions!==null?{instructions:edit.instructions}:{}),...(edit.checks!==null?{checks:edit.checks}:{})}:step);
 const completedSteps={...data.completedSteps};
 const changedMethod=edit.instructions!==null||edit.checks!==null;
 if(edit.checked!==null)completedSteps[edit.index]=edit.checked;
 if(changedMethod)completedSteps[edit.index]=false;
 if(completedSteps[edit.index]===false){
  const invalid=new Set([edit.index]);
  steps.forEach((step:any,index:number)=>{if((step.dependsOn||[]).some((dep:number)=>invalid.has(dep))){invalid.add(index);completedSteps[index]=false;}});
 }
 return {...data,steps,completedSteps,workRevision:(data.workRevision||0)+1,lastWorkUpdate:edit.note};
}
export async function updateWorkPlan(db:Queryable,owner:string,projectId:string|undefined,id:string,edit:WorkEdit,expectedRevision?:number){
 for(let attempt=0;attempt<3;attempt++){
  const found=await db.query("SELECT data FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='construction' AND ($3::uuid IS NULL OR project_id=$3)",[id,owner,projectId||null]);
  if(!found.rows.length)throw Error('Work plan not found in this project.');
  const data=found.rows[0].data;
  if(expectedRevision!==undefined&&(data.workRevision||0)!==expectedRevision)throw Error('The work plan changed. Refresh before saving this update.');
  const next=applyWorkUpdate(data,edit);
  const saved=await db.query("UPDATE roomwise.artifacts SET data=$1::jsonb WHERE id=$2 AND user_id=$3 AND data=$4::jsonb RETURNING id",[JSON.stringify(next),id,owner,JSON.stringify(data)]);
  if(saved.rows.length)return next;
 }
 throw Error('The work plan changed. Refresh before saving this update.');
}
export function workContext(data:any,message=""){
 const focus=new Set<number>();
 const next=data.steps.findIndex((_:any,index:number)=>!data.completedSteps?.[index]);if(next>=0){focus.add(next);if(next>0)focus.add(next-1);}
 for(const match of message.matchAll(/(?:step|étape|schritt|paso)\s*(\d+)/gi))focus.add(Number(match[1])-1);
 return {title:data.title,estimateId:data.estimateId,workRevision:data.workRevision||0,completedSteps:data.completedSteps||{},overview:data.overview,assumptions:data.assumptions,steps:data.steps.map((step:any,index:number)=>({index,...step,instructions:focus.has(index)?step.instructions:step.instructions.slice(0,1).map((line:string)=>line.slice(0,180)),checks:focus.has(index)?step.checks:step.checks.slice(0,1),contextDetail:focus.has(index)?"full":"summary"}))};}
