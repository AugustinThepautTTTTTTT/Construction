export type ProductTarget={estimateId:string;index:number};
export type ChatRequest=(message:string,productTarget?:ProductTarget)=>void;
export function productChatRequest(estimateId:string,index:number,item:string){
 return {message:`Find products for ${item} from my materials list, near my renovation location. Compare suitable options from different stores.`,productTarget:{estimateId,index}};
}
