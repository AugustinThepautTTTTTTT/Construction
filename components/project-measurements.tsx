"use client";
import {useEffect,useState} from "react";
import type {FormEvent} from "react";
import {Button} from "@base-ui-components/react/button";
import type {Artifact} from "@/lib/room-artifacts";

const surfaces=[
  {key:"floorArea",name:"Floor to cover",unit:"m²",purpose:"PVC flooring, underlay and surface preparation",max:1500},
  {key:"wallArea",name:"Walls to finish",unit:"m²",purpose:"Primer, filler and wall paint; exclude retained tiles and openings",max:10000},
  {key:"ceilingArea",name:"Ceiling to finish",unit:"m²",purpose:"Ceiling coating and paint",max:1500},
  {key:"perimeter",name:"Edges and skirting",unit:"m",purpose:"Trims, skirting and edge finishing",max:1000},
] as const;
const siteChecks=[
  ["Shower opening","Measure bottom, middle and top widths, plus height, before ordering glass"],
  ["Vanity","Measure available width, depth, plumbing centres and door/drawer clearance"],
  ["WC","Inspect floor fixings, waste connection, clearance and existing boxing before repositioning"],
  ["Lighting","Identify ceiling construction, bathroom electrical zones and suitable IP ratings"],
  ["Floor","Check subfloor flatness, moisture, thresholds and door clearance"],
  ["Storage","Measure each cabinet internal width, depth, height and door swing"],
] as const;
export function ProjectMeasurements({artifact,onChanged,onAsk}:{artifact?:Artifact;onChanged:()=>void|Promise<void>;onAsk:(text:string)=>void}){
  const current=artifact?.data.measurements;
  const [values,setValues]=useState<Record<string,string>>({});
  const [confirmed,setConfirmed]=useState(false);
  const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    setValues(Object.fromEntries(surfaces.map(({key})=>[key,current?.[key]==null?"":String(current[key])])));
    setConfirmed(!!current?.confirmed);
    setNotes(current?.notes||"");
  },[artifact?.id,JSON.stringify(current)]);
  const count=surfaces.filter(({key})=>Number(values[key])>0).length;
  async function save(e:FormEvent){
    e.preventDefault();
    if(!artifact)return;
    setSaving(true);setError("");
    try{
      const measurements=Object.fromEntries(surfaces.map(({key})=>[key,values[key]?.trim()?Number(values[key]):null]));
      const r=await fetch(`/api/artifacts/${artifact.id}/project`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"measurements",measurements:{...measurements,confirmed,notes}})});
      const data=await r.json();if(!r.ok)throw new Error(data.error||"Could not save measurements.");
      await onChanged();
    }catch(e){setError(e instanceof Error?e.message:"Could not save measurements.");}finally{setSaving(false);}
  }
  return <section className="projectMeasurementRegister">
    <div className="projectSectionIntro"><small>MEASUREMENT REGISTER</small><h2>Measure once. Plan accurately.</h2><p>Saved surface dimensions recalculate your shopping quantities. Do not confirm measurements until you have checked them on site.</p></div>
    {artifact?<form className="projectMeasurements" onSubmit={save}>
      <p><strong>{count} of {surfaces.length} surfaces recorded</strong> · {confirmed?"Marked checked":"Still provisional"}</p>
      <div>{surfaces.map(s=><label key={s.key}>{s.name} · {s.unit}<input type="number" min="0.01" max={s.max} step="0.01" value={values[s.key]??""} placeholder="Not measured" onChange={e=>{setValues(v=>({...v,[s.key]:e.target.value}));setConfirmed(false);}}/><small>{s.purpose}</small></label>)}</div>
      <label>Notes and deductions<textarea maxLength={1000} value={notes} onChange={e=>{setNotes(e.target.value);setConfirmed(false);}} placeholder="Widths, heights, deductions, exceptions and checks"/></label>
      <label className="projectCheck"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked these measurements on site</label>
      {error&&<p role="alert">{error}</p>}
      <Button type="submit" disabled={saving}>{saving?"Saving…":"Save measurements & recalculate shopping list"}</Button>
    </form>:<div className="projectFolderEmpty"><h3>Your measurement register starts with a shopping list.</h3><p>Generate a shopping list first so measured surfaces can update the exact quantities and budget.</p><Button onClick={()=>onAsk("Prepare a shopping list for my renovation including surfaces to measure, preparation supplies, tools, consumables and estimated quantities. Flag all unverified dimensions.")}>Create shopping list</Button></div>}
    <div className="projectSectionIntro"><small>BEFORE YOU BUY</small><h3>Site verification checklist</h3><p>These checks are guidance, not saved dimensional values. Capture the results in notes until a dedicated fixture register is available.</p></div>
    <ul>{siteChecks.map(([name,details])=><li key={name}><strong>{name}</strong><p>{details}</p></li>)}</ul>
  </section>;
}
