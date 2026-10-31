"use client";
import {useCallback,useEffect,useState} from "react";
import {Button} from "@base-ui-components/react/button";
import {Plus,RotateCcw,Trash2} from "lucide-react";
import type {Artifact} from "@/lib/room-artifacts";
import type {Workspace,WorkspaceChange} from "@/lib/renovation-workspace";
import {emptyWorkspace,purchaseKey,shoppingReadiness} from "@/lib/renovation-workspace";
type Snapshot={state:Workspace;revision:number};
const unique=()=>crypto.randomUUID();
export function useRenovationWorkspace(projectId:string,signal:number){
 const [snapshot,setSnapshot]=useState<Snapshot>({state:emptyWorkspace,revision:0}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const reload=useCallback(async()=>{try{const r=await fetch(`/api/projects/${projectId}/renovation`,{cache:"no-store"});if(!r.ok)throw new Error("Could not load renovation workspace");setSnapshot(await r.json());setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load project");}finally{setLoading(false);}},[projectId]);
 useEffect(()=>{void reload();},[reload,signal]);
 const change=async(change:WorkspaceChange)=>{setSaving(true);setError("");try{const r=await fetch(`/api/projects/${projectId}/renovation`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:snapshot.revision,change})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Could not save");setSnapshot(data);return true;}catch(e){setError(e instanceof Error?e.message:"Could not save");await reload();return false;}finally{setSaving(false);}};
 return {snapshot,loading,saving,error,change,reload};
}
type Controller=ReturnType<typeof useRenovationWorkspace>;
export function RenovationDecisions({controller}:{controller:Controller}){
 const {snapshot,change,saving,error}=controller;
 const [label,setLabel]=useState(""),[details,setDetails]=useState(""),[element,setElement]=useState("");
 const decisions=snapshot.state.decisions;
 return <section className="projectRenovation"><div className="projectSectionIntro"><small>PROJECT MEMORY</small><h2>Decisions & constraints</h2><p>Distinguish ideas from approved changes. Keep a trace of what was decided before shopping or starting work.</p></div>
 <div className="projectRenovationBody">
  <form onSubmit={e=>{e.preventDefault();if(!label.trim())return;void change({action:"decision",value:{id:unique(),label:label.trim(),details,element,status:"proposed",updatedAt:new Date().toISOString()}}).then(ok=>{if(ok){setLabel("");setDetails("");setElement("");}});}}>
   <label>Decision <input required maxLength={140} value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Keep existing wall tiles"/></label>
   <label>Room element <input maxLength={120} value={element} onChange={e=>setElement(e.target.value)} placeholder="Walls, WC, shower…"/></label>
   <label>Details <textarea maxLength={1000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Constraints and rationale"/></label>
   <Button disabled={saving||!label.trim()} type="submit"><Plus size={14}/> Add proposal</Button>
  </form>
  {decisions.length===0?<p>No decisions recorded yet. Add a proposal, then confirm it when you are certain.</p>:decisions.map(d=><article key={d.id}><strong>{d.label}</strong><small>{d.element||"Whole project"} · {d.status}</small>{d.details&&<p>{d.details}</p>}<div className="projectRenovationActions"><select aria-label={`Status of ${d.label}`} disabled={saving} value={d.status} onChange={e=>void change({action:"decision",value:{...d,status:e.target.value as typeof d.status,updatedAt:new Date().toISOString()}})}><option value="proposed">Proposed</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select><Button disabled={saving} aria-label={`Remove ${d.label}`} onClick={()=>void change({action:"remove_decision",id:d.id})}><Trash2 size={14}/></Button></div></article>)}
  <p className="projectRenovationWarning">Changes to decisions are recorded, but automatic alteration of generated plans or purchases requires regeneration and review. Never treat a concept image as construction approval.</p>
  {error&&<p role="alert">{error}</p>}
  <Button disabled={saving||snapshot.revision===0} onClick={()=>void change({action:"undo"})}><RotateCcw size={14}/> Undo last workspace change</Button>
 </div></section>;
}
const checks=[
 ["Shower opening","cm","bottom, middle and top widths; height"],
 ["Vanity width","cm","clear space and plumbing position"],
 ["WC clearance","cm","existing waste connection and fixings"],
 ["Door clearance","mm","threshold and floor build-up"],
 ["Cabinet interior","cm","internal width, height and depth"],
 ["Ceiling clearance","cm","slope, structure and safe lighting zones"],
];
export function FixtureMeasurements({controller,photos=[]}:{controller:Controller;photos?:{id:string;created_at:string}[]}){
 const {snapshot,change,saving,error}=controller;
 const [label,setLabel]=useState(""),[zone,setZone]=useState(""),[value,setValue]=useState(""),[unit,setUnit]=useState<"mm"|"cm"|"m"|"m²">("cm"),[notes,setNotes]=useState(""),[photoId,setPhotoId]=useState<string|null>(null);
 const rows=snapshot.state.measurements;
 return <section className="projectRenovation"><div className="projectSectionIntro"><small>SITE SURVEY</small><h2>Fixtures & clearances</h2><p>Record verified dimensions before selecting a shower door, vanity, floor system or fixture. Attach photo references in notes for now.</p></div>
 <div className="projectRenovationBody">
 <div className="projectCheckSuggestions"><strong>Suggested checks</strong>{checks.map(([a,b,c])=><Button key={a} onClick={()=>{setLabel(a);setUnit(b as typeof unit);setNotes(c);}}>{a}</Button>)}</div>
 <form onSubmit={e=>{e.preventDefault();if(!label.trim()||!Number.isFinite(Number(value))||Number(value)<=0)return;void change({action:"measurement",value:{id:unique(),label:label.trim(),zone,value:Number(value),unit,confidence:"measured",notes,photoId}}).then(ok=>{if(ok){setLabel("");setValue("");setNotes("");}});}}>
  <label>Measurement <input maxLength={140} required value={label} onChange={e=>setLabel(e.target.value)}/></label>
  <label>Area/fixture <input maxLength={100} value={zone} onChange={e=>setZone(e.target.value)} placeholder="Shower"/></label>
  <div className="projectInlineInputs"><label>Value <input type="number" min=".001" step="any" max="100000" required value={value} onChange={e=>setValue(e.target.value)}/></label><label>Unit <select value={unit} onChange={e=>setUnit(e.target.value as typeof unit)}><option>mm</option><option>cm</option><option>m</option><option>m²</option></select></label></div>
  <label>How/where measured <textarea maxLength={700} value={notes} onChange={e=>setNotes(e.target.value)}/></label>{photos.length>0&&<label>Reference room photo <select value={photoId||""} onChange={e=>setPhotoId(e.target.value||null)}><option value="">None</option>{photos.map((p,i)=><option key={p.id} value={p.id}>Uploaded photo {i+1}</option>)}</select></label>}<Button disabled={saving||!label.trim()} type="submit"><Plus size={14}/> Save measurement</Button>
 </form>
 {rows.map(m=><article key={m.id}><strong>{m.label} — {m.value} {m.unit}</strong><small>{m.zone||"Unassigned"} · {m.confidence}{m.photoId?" · Photo linked":""}</small><p>{m.notes}</p><div className="projectRenovationActions"><select aria-label={`Confidence for ${m.label}`} value={m.confidence} disabled={saving} onChange={e=>void change({action:"measurement",value:{...m,confidence:e.target.value as typeof m.confidence}})}><option value="estimated">Estimated</option><option value="measured">Measured</option><option value="verified">Verified on site</option></select><Button disabled={saving} onClick={()=>void change({action:"remove_measurement",id:m.id})}><Trash2 size={14}/></Button></div></article>)}
 {error&&<p role="alert">{error}</p>}</div></section>;
}
export function ShoppingOrganizer({controller,bill}:{controller:Controller;bill?:Artifact}){
 const {snapshot,change,saving}=controller;
 if(!bill)return null;
 const items=(bill.data.calculations?.items||[]) as Array<{item:string;index:number;quantity:number;unit:string;basis:string}>;
 const measured=!!bill.data.measurements?.confirmed && !bill.data.calculations?.provisional;
 const [group,setGroup]=useState("All");
 const stores=[...new Set(items.map(row=>snapshot.state.purchases[purchaseKey(bill.id,row.index)]?.store).filter(Boolean))] as string[];
 const groups=["All","To buy","Purchased","Already owned",...stores.map(store=>"Store: "+store)];
 const visible=items.filter(row=>{const p=snapshot.state.purchases[purchaseKey(bill.id,row.index)];return group==="All"||(group==="To buy"?!["purchased","owned"].includes(p?.status||""):(group==="Purchased"?p?.status==="purchased":group==="Already owned"?p?.status==="owned":p?.store===group.slice(7)));});
 const bought=items.filter(row=>["purchased","owned"].includes(snapshot.state.purchases[purchaseKey(bill.id,row.index)]?.status)).length;
 return <div className="projectRenovationBody projectShopOrganizer"><h3>Purchase tracker</h3><p>{bought} of {items.length} items purchased or already owned · Costs entered are actual spending, not estimated prices.</p><div className="projectInlineInputs"><label>Show <select value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g}>{g}</option>)}</select></label></div>
 {visible.map(row=>{const key=purchaseKey(bill.id,row.index),data=snapshot.state.purchases[key]||{status:shoppingReadiness(undefined,measured||row.basis==="manual"),store:"",actualCost:null,notes:""};return <article key={key}><strong>{row.item}</strong><small>{row.quantity} {row.unit} · {data.status.replaceAll("_"," ")}</small><div className="projectInlineInputs"><label>Status <select disabled={saving} value={data.status} onChange={e=>void change({action:"purchase",key,value:{...data,status:e.target.value as typeof data.status}})}><option value="suggested">Suggested</option><option value="needs_measurements">Needs measurements</option><option value="ready">Ready to buy</option><option value="purchased">Purchased</option><option value="owned">Already owned</option></select></label><label>Store <input defaultValue={data.store} key={key+":store:"+data.store} maxLength={100} placeholder="Store" onBlur={e=>{if(e.target.value!==data.store)void change({action:"purchase",key,value:{...data,store:e.target.value}});}}/></label><label>Actual € <input key={key+":cost:"+data.actualCost} type="number" min="0" step=".01" placeholder="—" defaultValue={data.actualCost??""} onBlur={e=>{const v=e.target.value?Number(e.target.value):null;if(v!==data.actualCost)void change({action:"purchase",key,value:{...data,actualCost:v}});}}/></label></div></article>;})}
 {snapshot.state.decisions.some(d=>d.status==="confirmed")&&<p className="projectRenovationWarning">Confirmed design decisions should be reviewed against this shopping list when project scope changes. Existing purchases are preserved.</p>}
 <p className="projectRenovationWarning">Purchase status is user-controlled. Measurements and product compatibility still require site verification; a checked item is not a compatibility guarantee.</p>
 </div>;
}
export function DowntimePlanner({controller,work}:{controller:Controller;work?:Artifact}){
 const {snapshot,change,saving,error}=controller;
 const steps=(work?.data.steps||[]) as Array<{title:string;duration?:string;dependsOn?:number[];professionalRequired?:boolean}>;
 return <section className="projectRenovation"><div className="projectSectionIntro"><small>WORK SEQUENCING</small><h2>Room availability</h2><p>Identify which steps interrupt essential fixtures. Confirm dependencies and drying times before scheduling the work.</p></div>
 <div className="projectRenovationBody"><label className="projectAvailability"><input type="checkbox" checked={snapshot.state.keepRoomUsable} disabled={saving} onChange={e=>void change({action:"usability",value:e.target.checked})}/> Keep bathroom usable throughout renovation where practical</label>
 {!work?<p>Generate a construction plan to assign fixture downtime.</p>:steps.map((step,index)=>{const key=`${work.id}:${index}`,d=snapshot.state.downtime[key]||{fixture:"whole_room" as const,description:"",durationHours:null};return <article key={key}><strong>{index+1}. {step.title}</strong><small>{step.duration||"Duration unknown"}{step.dependsOn?.length?` · After: ${step.dependsOn.map(x=>x+1).join(", ")}`:""}{step.professionalRequired?" · Professional required":""}</small><div className="projectInlineInputs"><label>Impact <select disabled={saving} value={d.fixture} onChange={e=>void change({action:"downtime",key,value:{...d,fixture:e.target.value as typeof d.fixture}})}><option value="whole_room">Whole room / unassessed</option><option value="wc">WC</option><option value="shower">Shower</option><option value="basin">Basin</option></select></label><label>Hours (if known) <input type="number" min="0" max="1000" step=".5" defaultValue={d.durationHours??""} key={key+":"+d.durationHours} onBlur={e=>{const v=e.target.value?Number(e.target.value):null;if(v!==d.durationHours)void change({action:"downtime",key,value:{...d,durationHours:v}});}}/></label></div><label>Downtime notes <input key={key+":note:"+d.description} maxLength={300} defaultValue={d.description} placeholder="When fixture is unavailable, restoration checks…" onBlur={e=>{if(e.target.value!==d.description)void change({action:"downtime",key,value:{...d,description:e.target.value}});}}/></label></article>;})}
 {snapshot.state.keepRoomUsable&&<p className="projectRenovationWarning">Preserve access to essential fixtures: schedule disruptive tasks in short windows and check that a usable WC, shower and basin remain available where possible.</p>}
 <p className="projectRenovationWarning">No automatically generated timeline is approved: fixture availability, drying times, safe electrical isolation and contractor dependencies must be checked on site.</p>{error&&<p role="alert">{error}</p>}
 </div></section>;
}
