"use client";
import {useState} from 'react';
import {Button} from '@base-ui-components/react/button';
import {Check,ExternalLink,Search} from 'lucide-react';
import {calculateEstimate,type Artifact,type PriceSource} from '@/lib/room-artifacts';
import {applyProductPacks} from '@/lib/price-research';
import {money,retailerName} from '@/lib/material-presentation';
export function ProductComparisonView({artifact,index,onChanged,unlocked=true}:{artifact:Artifact;index:number;onChanged:()=>void|Promise<void>;unlocked?:boolean}){
 const [preferences,setPreferences]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const data=artifact.data,comparison=data.productComparisons?.[index],selected=data.priceSources?.find((p:PriceSource)=>p.index===index);
 async function request(method:'POST'|'PATCH',body:unknown){setBusy(true);setNotice('');try{const r=await fetch(`/api/artifacts/${artifact.id}/prices`,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await r.json();if(!r.ok)throw new Error(result.error);await onChanged();}catch(e){setNotice(e instanceof Error?e.message:'Could not finish the product comparison.');}finally{setBusy(false);}}
 const options=(comparison?.products||[]).map((source:PriceSource)=>{
  const baseline={...data,items:data.quantityItems||data.items};
  const candidate=applyProductPacks(baseline,[source]),row=calculateEstimate(candidate,data.plan||null).items[index];
  return {source,row,total:Math.round(row.quantity*source.price*100)/100};
 });
 return <section className="productComparison" aria-label={`Product comparison for ${data.items[index]?.item}`}>
  <div className="productCompareIntro"><Search size={15}/><div><strong>Compare products</strong><p>Optional search for this item only. Explore suitable shops and specialists near {data.city||data.country}.</p></div></div>
  <form onSubmit={e=>{e.preventDefault();void request('POST',{index,preferences});}}><label>Refine the search<input maxLength={500} value={preferences} onChange={e=>setPreferences(e.target.value)} placeholder="e.g. matt blue, washable, under €40"/></label><Button type="submit" disabled={busy||!unlocked}><Search size={13}/>{busy?'Checking this item…':comparison?'Compare again':'Search this item'}</Button></form>
  {notice&&<p className="projectFootnote" role="status">{notice}</p>}
  {options.length>0&&<div className="productOptions">{options.map(({source,row,total}:{source:PriceSource;row:any;total:number})=><article key={source.url} className={selected?.url===source.url?'selected':''}>
   <small>{retailerName(source.url)}{selected?.url===source.url?' · Selected':''}</small><h4>{source.title}</h4><p>{source.note}</p>
   <dl><div><dt>Pack price</dt><dd>{money(source.price,data.currency)} / {row.unit}</dd></div><div><dt>Buy for your project</dt><dd>{row.quantity} {row.unit}</dd></div><div><dt>Material total</dt><dd>{money(total,data.currency)}</dd></div><div><dt>Pack size / coverage</dt><dd>{source.quantityPerPack&&source.quantityPerPack!==1?`${source.quantityPerPack} ${data.quantityItems?.[index]?.unit||data.items[index].unit} / ${row.unit}`:source.coveragePerUnit?`${source.coveragePerUnit} basis units / ${row.unit}`:'Check product specifications'}</dd></div></dl>
   <div><a href={source.url} target="_blank" rel="noopener noreferrer">View product<ExternalLink size={12}/></a><Button disabled={busy||selected?.url===source.url} onClick={()=>void request('PATCH',{index,url:source.url})}>{selected?.url===source.url?<><Check size={12}/>In your bill</>:'Use in my bill'}</Button></div>
  </article>)}</div>}
  {comparison&&<p className="projectFootnote">{comparison.notice} Checked {new Date(comparison.checkedAt).toLocaleDateString('en-GB')}.</p>}
 </section>;
}
