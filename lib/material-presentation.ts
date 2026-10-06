import type { Artifact,PriceSource } from "./room-artifacts";
export function productUrl(value:string){try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function retailerName(value:string){try{const host=new URL(value).hostname.replace(/^www\./,"");const names:Record<string,string>={"leroymerlin.fr":"Leroy Merlin","castorama.fr":"Castorama","ikea.com":"IKEA","manomano.fr":"ManoMano","bricodepot.fr":"Brico Dépôt"};return names[host]||host;}catch{return "Retailer";}}
export function money(value:number,currency:string){try{return new Intl.NumberFormat("en-GB",{style:"currency",currency,maximumFractionDigits:2}).format(value);}catch{return `${value.toFixed(2)} ${currency}`;}}
export function materialPresentation(artifact:Artifact){
 const data=artifact.data,sources:PriceSource[]=data.priceSources||[];
 const rows=(data.calculations?.items||[]).map((item:any)=>{const found=sources.find(s=>s.index===item.index),source=found&&productUrl(found.url)&&Number.isFinite(found.price)&&found.price>0?found:null;return{...item,source,subtotal:source?Math.round(source.price*item.quantity*100)/100:null};});
 const sourced=rows.reduce((sum:number,row:any)=>sum+(row.subtotal||0),0),allowanceLow=rows.filter((r:any)=>!r.source).reduce((s:number,r:any)=>s+r.low,0),allowanceHigh=rows.filter((r:any)=>!r.source).reduce((s:number,r:any)=>s+r.high,0);
 const round=(n:number)=>Math.round(n*100)/100;
 return{rows,sourced:round(sourced),allowanceLow:round(allowanceLow),allowanceHigh:round(allowanceHigh),low:round(sourced+allowanceLow),high:round(sourced+allowanceHigh),verifiedCount:rows.filter((r:any)=>r.source).length,currency:data.currency};
}
