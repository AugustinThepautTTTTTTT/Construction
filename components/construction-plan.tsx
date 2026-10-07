"use client";
import {useEffect,useState} from "react";
import { Button } from "@base-ui-components/react/button";
import { ArrowUpRight, ClipboardList,Check,ChevronDown } from "lucide-react";
import type { Artifact } from "@/lib/room-artifacts";
import { money, productUrl, retailerName } from "@/lib/material-presentation";
export function ConstructionPlanView({artifact,onOpen,onMaterial,onChanged,focusStep,compact=false}:{artifact:Artifact;onOpen?:(id:string)=>void;onMaterial?:(billId:string,index:number)=>void;onChanged?:()=>void|Promise<void>;focusStep?:number|null;compact?:boolean}){
 const [saving,setSaving]=useState(false),[notice,setNotice]=useState("");
 async function complete(index:number){setSaving(true);try{const r=await fetch(`/api/artifacts/${artifact.id}/project`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"step",index,checked:!artifact.data.completedSteps?.[index]})}),data=await r.json();if(!r.ok)throw new Error(data.error);await onChanged?.();}catch(e){setNotice(e instanceof Error?e.message:"Could not save progress.");}finally{setSaving(false);}}
 const [expandedStep,setExpandedStep]=useState<number|null>(focusStep??0);
 useEffect(()=>{if(focusStep!=null)setExpandedStep(focusStep);},[focusStep]);
 const plan=artifact.data;
 return <section className={`constructionPlan ${compact?"compact":""}`} aria-label="Construction plan">
  <header><div><ClipboardList size={15}/>Your works plan</div><h3>{plan.title}</h3><p>{plan.overview}</p>{onOpen&&<Button onClick={()=>onOpen(plan.estimateId)}>Linked bill · {plan.billTitle||"Materials"}<ArrowUpRight size={13}/></Button>}</header>
  {notice&&<p role="status">{notice}</p>}
  {compact&&<p className="worksProgress">{Object.values(plan.completedSteps||{}).filter(Boolean).length} of {plan.steps.length} steps complete</p>}
  <ol>{plan.steps.map((step:any,index:number)=><li key={index}><span className="constructionNumber">{String(index+1).padStart(2,"0")}</span><details open={!compact||expandedStep===index}><summary onClick={e=>{if(compact){e.preventDefault();setExpandedStep(expandedStep===index?null:index);}}}><h4>{step.title}</h4>{compact&&<><span>{plan.completedSteps?.[index]?"Complete":step.duration}</span><ChevronDown size={14}/></>}</summary>{compact&&onChanged&&<Button className="workComplete" disabled={saving} aria-pressed={!!plan.completedSteps?.[index]} onClick={()=>void complete(index)}><Check size={13}/>{plan.completedSteps?.[index]?"Completed · undo":"Mark step complete"}</Button>}<p className="constructionTiming">{step.duration}{step.dryingTime?` · Wait / dry: ${step.dryingTime}`:""}</p>{step.professionalRequired&&<small className="constructionProfessional">Qualified professional required</small>}
   <ul>{step.instructions.map((instruction:string,i:number)=><li key={i}>{instruction}</li>)}</ul>
   {!!step.dependsOn?.length&&<small>After {step.dependsOn.map((n:number)=>`step ${n+1}`).join(", ")}</small>}
   {!!step.materials?.length&&<div className="constructionMaterials"><strong>Materials & tools</strong>{step.materials.map((row:any)=>{const url=row.source?productUrl(row.source.url):null;return <div key={row.index}><span>{row.item}<small>{row.quantity} {row.unit}{row.source?` · ${money(row.source.price,plan.currency)} / ${row.unit}`:" · Estimated allowance"}</small></span>{onMaterial?<Button onClick={()=>onMaterial(plan.estimateId,row.index)}>View material<ArrowUpRight size={12}/></Button>:url?<a href={url} target="_blank" rel="noopener noreferrer">{retailerName(url)}<ArrowUpRight size={12}/></a>:onOpen?<Button onClick={()=>onOpen(plan.estimateId)}>BOM #{row.index+1}</Button>:<small>BOM #{row.index+1}</small>}</div>;})}</div>}
   {!!step.checks?.length&&<div className="constructionChecks"><strong>Ready when</strong><p>{step.checks.join(" · ")}</p></div>}
  </details></li>)}</ol>
  {!!plan.assumptions?.length&&<details><summary>Planning assumptions</summary>{plan.assumptions.map((text:string,i:number)=><p key={i}>{text}</p>)}</details>}
  {!compact&&onOpen&&<footer><Button onClick={()=>onOpen(artifact.id)}>In your project<ArrowUpRight size={13}/></Button></footer>}
 </section>;
}
