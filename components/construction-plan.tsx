"use client";
import { Button } from "@base-ui-components/react/button";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import type { Artifact } from "@/lib/room-artifacts";
import { money, productUrl, retailerName } from "@/lib/material-presentation";
export function ConstructionPlanView({artifact,onOpen,compact=false}:{artifact:Artifact;onOpen?:(id:string)=>void;compact?:boolean}){
 const plan=artifact.data;
 return <section className={`constructionPlan ${compact?"compact":""}`} aria-label="Construction plan">
  <header><div><ClipboardList size={15}/>Your works plan</div><h3>{plan.title}</h3><p>{plan.overview}</p>{onOpen&&<Button onClick={()=>onOpen(plan.estimateId)}>Linked bill · {plan.billTitle||"Materials"}<ArrowUpRight size={13}/></Button>}</header>
  <ol>{plan.steps.map((step:any,index:number)=><li key={index}><span className="constructionNumber">{String(index+1).padStart(2,"0")}</span><div><h4>{step.title}</h4><p className="constructionTiming">{step.duration}{step.dryingTime?` · Wait / dry: ${step.dryingTime}`:""}</p>{step.professionalRequired&&<small className="constructionProfessional">Qualified professional required</small>}
   <ul>{step.instructions.map((instruction:string,i:number)=><li key={i}>{instruction}</li>)}</ul>
   {!!step.dependsOn?.length&&<small>After {step.dependsOn.map((n:number)=>`step ${n+1}`).join(", ")}</small>}
   {!!step.materials?.length&&<div className="constructionMaterials"><strong>Materials & tools</strong>{step.materials.map((row:any)=>{const url=row.source?productUrl(row.source.url):null;return <div key={row.index}><span>{row.item}<small>{row.quantity} {row.unit}{row.source?` · ${money(row.source.price,plan.currency)} / ${row.unit}`:" · Estimated allowance"}</small></span>{url?<a href={url} target="_blank" rel="noopener noreferrer">{retailerName(url)}<ArrowUpRight size={12}/></a>:onOpen?<Button onClick={()=>onOpen(plan.estimateId)}>BOM #{row.index+1}</Button>:<small>BOM #{row.index+1}</small>}</div>;})}</div>}
   {!!step.checks?.length&&<div className="constructionChecks"><strong>Ready when</strong><p>{step.checks.join(" · ")}</p></div>}
  </div></li>)}</ol>
  {!!plan.assumptions?.length&&<details><summary>Planning assumptions</summary>{plan.assumptions.map((text:string,i:number)=><p key={i}>{text}</p>)}</details>}
  {!compact&&onOpen&&<footer><Button onClick={()=>onOpen(artifact.id)}>In your project<ArrowUpRight size={13}/></Button></footer>}
 </section>;
}
