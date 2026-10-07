"use client";
import { useEffect,useRef,useState } from "react";
import { Button } from "@base-ui-components/react/button";
import { Download,X } from "lucide-react";
import type { Artifact } from "@/lib/room-artifacts";
export function ProjectComparison({artifact,onClose}:{artifact:Artifact;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[mode,setMode]=useState<"slide"|"side">("side"),[split,setSplit]=useState(50),[ratio,setRatio]=useState(1);
 const before=`/api/photos/${artifact.data.sourcePhotoId}`,after=`/api/artifacts/${artifact.id}/image`;
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
 return <dialog ref={dialog} className="projectComparison" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label="Before and after comparison">
 <div className="comparisonShell"><header><div><small>YOUR ROOM · DESIGN CONCEPT</small><h2>{artifact.data.title}</h2></div><Button aria-label="Close comparison" onClick={onClose}><X size={20}/></Button></header>
 <div className="comparisonTools"><div><Button aria-pressed={mode==="side"} onClick={()=>setMode("side")}>Side by side</Button><Button aria-pressed={mode==="slide"} onClick={()=>setMode("slide")}>Compare slider</Button></div><a href={after} download="archicova-after.jpg"><Download size={15}/>Save concept</a></div>
 {mode==="side"?<div className="comparisonPair"><figure><img src={before} alt="Before: original room"/><figcaption>Before · your original photo</figcaption></figure><figure><img src={after} alt="After: room improvement concept"/><figcaption>After · illustrative concept</figcaption></figure></div>:<><div className="comparisonStage" style={{aspectRatio:ratio,width:`min(100%, ${62*ratio}vh)`}}><img src={after} alt="After: room improvement concept"/><div className="comparisonBefore" style={{clipPath:`inset(0 ${100-split}% 0 0)`}}><img src={before} alt="Before: original room" onLoad={e=>setRatio(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)}/></div><div className="comparisonDivider" style={{left:`${split}%`}}/><span className="compareLabel before">Before</span><span className="compareLabel after">After</span></div><label className="compareRange">Reveal before / after<input type="range" aria-label="Before and after split" min={0} max={100} value={split} onChange={e=>setSplit(Number(e.target.value))}/></label></>}
 <p className="comparisonCaption">{artifact.data.brief}</p><p className="comparisonNote">Check the layout and retained features against your original. Pictured finishes and furniture are concepts; shopping matches are listed separately in Materials.</p>
 </div></dialog>;
}
