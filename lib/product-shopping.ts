import {z} from 'zod';
import {estimateSchema,calculateEstimate,type PriceSource} from './room-artifacts';
import {applyProductPacks} from './price-research';
export const newProductSchema=z.object({estimateId:z.string().uuid().nullable(),item:z.string().trim().min(1).max(100),specification:z.string().trim().min(1).max(250),unit:z.string().trim().min(1).max(30),quantity:z.number().positive().max(100000).nullable(),preferences:z.string().max(500)}).strict();
export function shoppingEstimate(input:z.infer<typeof newProductSchema>,market:{city:string;country:string;currency:string}){
 const estimate=estimateSchema.parse({title:`Product search: ${input.item}`.slice(0,120),...market,items:[{item:input.item,specification:input.specification,basis:'manual',manualQuantity:input.quantity??1,unit:input.unit,coveragePerUnit:null,coats:1,waste:0,priceLow:0,priceHigh:0}],assumptions:[input.quantity===null?'Quantity is provisional: one unit for comparison. Confirm measured requirements before ordering.':'Quantity supplied for this comparison.'],exclusions:[]});
 return {...estimate,purpose:'product_lookup',shoppingDraft:true,quantityUnconfirmed:input.quantity===null,targetEstimateId:input.estimateId,calculations:calculateEstimate(estimate,null)};
}
export function addShoppingSelection(data:any,draft:any,draftId:string,source:PriceSource){
 if(data.shoppingDraft)throw new Error('Choose a complete material bill.');
 if(data.country!==draft.country||data.currency!==draft.currency||data.city.toLowerCase()!==draft.city.toLowerCase())throw new Error('The shopping area differs from your bill. Update its local estimate first.');
 const quantityItems=[...(data.quantityItems||data.items)],existing=data.shoppingSelections?.[draftId];
 const index=typeof existing==='number'?existing:quantityItems.length;
 if(index>=40)throw new Error('This bill already has 40 items. Remove an item before adding another.');
 if(typeof existing!=='number')quantityItems.push(draft.quantityItems?.[0]||draft.items[0]);
 const estimate=estimateSchema.parse(Object.fromEntries(Object.keys(estimateSchema.shape).map(key=>[key,key==='items'?quantityItems:key==='assumptions'?[...(data.assumptions||[]),...(draft.quantityUnconfirmed?[`Confirm quantity for ${draft.items[0].item}; one unit is provisional.`]:[])].slice(-12):data[key]])));
 const priceSources=[...(data.priceSources||[]).filter((p:PriceSource)=>p.index!==index),{...source,index}];
 const {items}=applyProductPacks(estimate,priceSources);
 return {...data,quantityItems,items,priceSources,assumptions:estimate.assumptions,shoppingSelections:{...data.shoppingSelections,[draftId]:index},calculations:calculateEstimate({...estimate,items},data.plan||null)};
}
