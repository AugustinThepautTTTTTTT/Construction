import {z} from 'zod';
import type {Queryable} from './repository';
import {measurementsSchema,calculateEstimate,estimateSchema} from './room-artifacts';
import {editMaterialBill,ProductSearchError} from './material-research';
import {applyProductPacks} from './price-research';
export const projectEditSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('measurements'),measurements:measurementsSchema}).strict(),
 z.object({action:z.literal('shopping'),index:z.number().int().min(0).max(39),checked:z.boolean()}).strict(),
 z.object({action:z.literal('quantity'),index:z.number().int().min(0).max(39),base:z.number().positive().max(100000),coats:z.number().int().min(1).max(4),waste:z.number().min(0).max(.3),coveragePerUnit:z.number().positive().max(1000).nullable()}).strict(),
 z.object({action:z.literal('step'),index:z.number().int().min(0).max(19),checked:z.boolean()}).strict(),
]);
export async function editProjectDeliverable(db:Queryable,owner:string,id:string,raw:unknown){
 const edit=projectEditSchema.parse(raw);
 if(edit.action==='step'){
  const saved=await db.query(`UPDATE roomwise.artifacts SET data=jsonb_set(data,'{completedSteps}',COALESCE(data->'completedSteps','{}'::jsonb) || $1::jsonb) WHERE id=$2 AND user_id=$3 AND kind='construction' AND jsonb_array_length(data->'steps')>$4 RETURNING id`,[JSON.stringify({[edit.index]:edit.checked}),id,owner,edit.index]);
  if(!saved.rows.length)throw new ProductSearchError('Work step not found.');return;
 }
 return editMaterialBill(db,owner,id,data=>{
  if(edit.action==='shopping'){
   if(!data.items[edit.index])throw new ProductSearchError('Material not found.');
   return {...data,shoppingChecked:{...data.shoppingChecked,[edit.index]:edit.checked}};
  }
  const quantityItems=(data.quantityItems||data.items).map((item:any)=>({...item}));
  if(edit.action==='quantity'){
   if(!quantityItems[edit.index])throw new ProductSearchError('Material not found.');
   quantityItems[edit.index]={...quantityItems[edit.index],basis:'manual',manualQuantity:edit.base,coats:edit.coats,waste:edit.waste,coveragePerUnit:edit.coveragePerUnit};
  }
  const measurements=edit.action==='measurements'?edit.measurements:data.measurements;
  const estimate=estimateSchema.parse(Object.fromEntries(Object.keys(estimateSchema.shape).map(key=>[key,key==='items'?quantityItems:key==='measurements'?measurements:data[key]])));
  const {items}=applyProductPacks(estimate,data.priceSources||[]);
  return {...data,quantityItems,measurements,items,calculations:calculateEstimate({...estimate,items},data.plan||null)};
 });
}
