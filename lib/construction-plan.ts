import { z } from "zod";
import type { Artifact } from "./room-artifacts";
import { materialPresentation } from "./material-presentation";
const line=z.string().min(1).max(800);
export const constructionSchema=z.object({
  title:z.string().min(1).max(120),
  estimateId:z.string().uuid(),
  overview:line,
  steps:z.array(z.object({
    title:z.string().min(1).max(120),
    instructions:z.array(line).min(1).max(8),
    materialIndexes:z.array(z.number().int().min(0).max(39)).max(20),
    dependsOn:z.array(z.number().int().min(0).max(19)).max(10),
    duration:z.string().max(180),
    dryingTime:z.string().max(250),
    checks:z.array(line).max(6),
    professionalRequired:z.boolean(),
  }).strict()).min(1).max(20),
  assumptions:z.array(line).max(12),
}).strict();
export type ConstructionPlan=z.infer<typeof constructionSchema>;
export function validateConstruction(plan:ConstructionPlan, bill:Pick<Artifact,"id"|"kind"|"data">){
  if(bill.kind!=="estimate"||bill.id!==plan.estimateId)throw new Error("Choose a saved bill from this project.");
  plan.steps.forEach((step,index)=>{
    if(step.materialIndexes.some(i=>!bill.data.items[i]))throw new Error("A step refers to a missing material. Complete the bill first.");
    if(step.dependsOn.some(i=>i>=index))throw new Error("Step dependencies must refer to earlier steps.");
  });
}
export function linkConstruction(plan:ConstructionPlan,bill:Artifact){
  validateConstruction(plan,bill);
  const material=materialPresentation(bill);
  return {...plan,billTitle:bill.data.title,currency:bill.data.currency,
    steps:plan.steps.map((step,index)=>({...step,index,materials:step.materialIndexes.map(i=>material.rows.find((row:any)=>row.index===i)).filter(Boolean)}))};
}
