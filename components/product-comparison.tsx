"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@base-ui-components/react/button";
import { Check, ExternalLink, Search, Package, MapPin, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { calculateEstimate, type Artifact, type PriceSource } from "@/lib/room-artifacts";
import { applyProductPacks } from "@/lib/price-research";
import { money, retailerName } from "@/lib/material-presentation";
import { CREDIT_COST } from "@/lib/credits";

export function ProductComparisonView({artifact,index,onChanged,unlocked=true,cardsOnly=false}:{artifact:Artifact;index:number;onChanged:()=>void|Promise<void>;unlocked?:boolean;cardsOnly?:boolean}) {
 const data=artifact.data;
 const saved=data.productComparisons?.[index];
 const [preferences,setPreferences]=useState(saved?.preferences||""),[city,setCity]=useState(saved?.location?.city||data.city||""),[postalCode,setPostalCode]=useState(saved?.location?.postalCode||"");
 const [pending,setPending]=useState<"POST"|"PATCH"|null>(null),[notice,setNotice]=useState(""),[local,setLocal]=useState<any>(null),[active,setActive]=useState(0),[refine,setRefine]=useState(false);
 const busy=pending!==null;
 const touch=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{setLocal(null);setActive(0);setPreferences(saved?.preferences||"");setCity(saved?.location?.city||data.city||"");setPostalCode(saved?.location?.postalCode||"");},[artifact.id,index]);
 const comparison=local||saved,selected=data.priceSources?.find((p:PriceSource)=>p.index===index);
 const options=(comparison?.products||[]).slice(0,6).map((source:PriceSource)=>{
  const baseline={...data,items:data.quantityItems||data.items},candidate=applyProductPacks(baseline,[source]),row=calculateEstimate(candidate,data.plan||null).items[index];
  return {source,row,total:Math.round(row.quantity*source.price*100)/100};
 });
 const current=Math.min(active,Math.max(0,options.length-1));
 function move(direction:number){if(options.length)setActive(value=>(value+direction+options.length)%options.length);}
 async function request(method:"POST"|"PATCH",body:unknown){
  if(busy)return;setPending(method);setNotice("");
  try{
   const r=await fetch(`/api/artifacts/${artifact.id}/prices`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),result=await r.json();
   if(!r.ok)throw new Error(result.error||"Could not finish this comparison.");
   if(method==='POST'){setLocal(result.comparison);setActive(0);setRefine(false);}await onChanged();
  }catch(e){setNotice(e instanceof Error?e.message:"Could not finish the product comparison.");}finally{setPending(null);}
 }
 return <details open className="productComparison productMarket" aria-label={`Find products for ${data.items[index]?.item}`}>
  <summary className="marketSummary"><Search size={16}/><strong>Products</strong><span>{data.items[index]?.item}</span></summary>
  <header className="marketHeader"><span className="marketEyebrow"><Search size={14}/>YOUR LOCAL MARKET</span><h3>{data.items[index]?.item}</h3><p><MapPin size={13}/>{[comparison?.location?.city||data.city,data.country].filter(Boolean).join(', ')||'Choose your shopping area'} · Compare retailer listings</p></header>
  {(!cardsOnly||refine)&&<form className="marketSearchForm" onSubmit={e=>{e.preventDefault();void request('POST',{index,preferences,location:{city:city.trim(),postalCode:postalCode.trim()}});}}>
   <div className="marketLocationFields"><label>City<input required maxLength={100} value={city} onChange={e=>setCity(e.target.value)} placeholder="Where are you shopping?" autoComplete="address-level2"/></label><label>Postcode <span>optional</span><input maxLength={20} value={postalCode} onChange={e=>setPostalCode(e.target.value)} placeholder="Local area" autoComplete="postal-code"/></label></div>
   <label>What matters to you?<input maxLength={500} value={preferences} onChange={e=>setPreferences(e.target.value)} placeholder="Colour, finish, dimensions or budget…"/></label>
   <div className="marketSearchAction"><Button type="submit" disabled={busy||!unlocked||!city.trim()}>{busy?<LoaderCircle size={15} className="marketSpinner"/>:<Search size={15}/>} {busy?(pending==='PATCH'?'Saving selection…':'Searching local retailers…'):comparison?'Refresh product search':'Find nearby products'}</Button><small>{CREDIT_COST.search} credits per new search · cached results are reused</small></div>
   {!unlocked&&<p className="marketUpgrade">Product search is included in Basic and Pro. <a href="/purchase?plan=basic">See plans</a></p>}
  </form>}
  {cardsOnly&&!refine&&<Button className="marketRefine" onClick={()=>setRefine(true)}><MapPin size={13}/>Change area or refine search</Button>}
  {notice&&<p className="marketNotice" role="alert">{notice}</p>}
  {busy&&<p className="marketSearching" role="status">{pending==='PATCH'?'Saving your selected product to the bill…':'Checking product pages, pack prices and suitable retailers. Your bill stays unchanged until you choose a product.'}</p>}
  {!!options.length&&<>
   <div className="marketCarousel" role="region" aria-roledescription="carousel" aria-label="Retailer product alternatives" tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();e.currentTarget.focus({preventScroll:true});move(1);}if(e.key==='ArrowLeft'){e.preventDefault();e.currentTarget.focus({preventScroll:true});move(-1);}}} onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const start=touch.current,t=e.changedTouches[0];touch.current=null;if(start&&Math.abs(t.clientX-start.x)>45&&Math.abs(t.clientX-start.x)>Math.abs(t.clientY-start.y))move(t.clientX<start.x?1:-1);}}>
    {options.map(({source,row,total}:{source:PriceSource;row:any;total:number},position:number)=>{
     const delta=(position-current+options.length)%options.length,offset=delta===0?0:delta===1?1:delta===options.length-1?-1:2;
     if(Math.abs(offset)>1)return null;
     const focused=offset===0,isSelected=selected?.url===source.url;
     return <div className={`marketCardShell ${focused?'focused':'side'}`} style={{'--card-offset':offset} as React.CSSProperties} key={source.url}>
      <article className={`marketProductCard ${isSelected?'selected':''}`} aria-roledescription="slide" aria-label={`${position+1} of ${options.length}: ${source.title}`} aria-hidden={!focused} inert={!focused?true:undefined}>
       <div className="marketStore"><span>{retailerName(source.url)}</span>{isSelected?<small><Check size={12}/>IN YOUR BILL</small>:<small>RETAILER LISTING</small>}</div>
       <div className="marketProductImage">{source.imageUrl&&<img src={source.imageUrl} alt={source.title} loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>}<Package size={44}/></div>
       <div className="marketProductInfo"><h4>{source.title}</h4><div className="marketPrice"><strong>{money(source.price,data.currency)}</strong><span>per {row.unit}</span></div><p className="marketProjectTotal">For your project <b>{money(total,data.currency)}</b><span>{row.quantity} {row.unit}</span></p>
        <details><summary>Fit, pack size & delivery</summary><p>{source.note}</p><p>{source.quantityPerPack&&source.quantityPerPack!==1?`${source.quantityPerPack} ${data.quantityItems?.[index]?.unit||data.items[index].unit} per ${row.unit}`:source.coveragePerUnit?`${source.coveragePerUnit} basis units of coverage per ${row.unit}`:'Check pack size and coverage on the product page.'}</p><p>Local stock, collection and delivery costs need retailer confirmation.</p></details>
        <div className="marketProductActions"><a href={source.url} target="_blank" rel="noopener noreferrer">View at store<ExternalLink size={13}/></a><Button disabled={busy||isSelected} onClick={()=>void request('PATCH',{index,url:source.url})}>{isSelected?<><Check size={13}/>Selected</>:'Add to BOM'}</Button></div>
       </div>
      </article>
      {!focused&&<button className="marketSideSelect" tabIndex={-1} aria-label={`Show ${source.title}`} onClick={()=>setActive(position)}/>}
     </div>;
    })}
   </div>
   <nav className="marketNavigation" aria-label="Product carousel controls"><Button aria-label="Previous product" disabled={options.length<2} onClick={()=>move(-1)}><ChevronLeft size={19}/></Button><span aria-live="polite" aria-atomic="true">{current+1} / {options.length}</span><Button aria-label="Next product" disabled={options.length<2} onClick={()=>move(1)}><ChevronRight size={19}/></Button></nav>
   <p className="marketCount">{new Set(options.map((option:any)=>retailerName(option.source.url))).size} stores compared · Swipe or use the arrows</p>
  </>}
  {!busy&&comparison&&!options.length&&<div className="marketEmpty"><Package size={28}/><strong>No verified matches yet</strong><p>Try a different finish, a clearer specification or a wider shopping area. Your bill has not changed.</p></div>}
  {comparison&&<p className="marketFootnote">{comparison.notice} Checked {new Date(comparison.checkedAt).toLocaleDateString('en-GB')}.</p>}
 </details>;
}
