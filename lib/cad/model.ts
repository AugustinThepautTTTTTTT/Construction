import { z } from "zod";
import { planSchema, validatePlan, type RoomPlan } from "../room-artifacts";
const point = z.object({x:z.number().min(0).max(50),y:z.number().min(0).max(50)}).strict();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/);
export const cadSchema = z.object({
  title:z.string().min(1).max(120), outline:z.array(point).min(3).max(12),
  height:z.number().min(1).max(10), wallThickness:z.number().min(.06).max(.6),
  floorColor:color, wallColor:color, confirmed:z.boolean(),
  openings:z.array(z.object({id,kind:z.enum(["door","window"]),wall:z.number().int().min(0).max(11),offset:z.number().min(0).max(50),width:z.number().min(.1).max(10),height:z.number().min(.1).max(5),sill:z.number().min(0).max(5)}).strict()).max(16),
  fixtures:z.array(z.object({id,label:z.string().min(1).max(80),shape:z.enum(["box","cylinder"]),x:z.number().min(0).max(50),y:z.number().min(0).max(50),z:z.number().min(0).max(10),width:z.number().min(.05).max(15),depth:z.number().min(.05).max(15),height:z.number().min(.05).max(10),rotation:z.number().min(-360).max(360),color}).strict()).max(30),
  assumptions:z.array(z.string().max(600)).max(12),
}).strict();
export type RoomCad = z.infer<typeof cadSchema>;
export type CadDocument = {projectId:string;revision:number;model:RoomCad;updated_at:string;author:"user"|"ai";summary:string};
export type CadRevision = {revision:number;created_at:string;author:string;summary:string};
export const cadUpdateSchema = z.object({baseRevision:z.number().int().min(0),changeSummary:z.string().min(1).max(240),model:cadSchema}).strict();
export function cadPlan(model:RoomCad):RoomPlan {
  return {...planSchema.parse({title:model.title,outline:model.outline,ceilingHeight:model.height,openings:model.openings.map(o=>({kind:o.kind,wall:o.wall,offset:o.offset,width:o.width,height:o.height})),fixtures:[],surfaces:[],assumptions:model.assumptions,questions:[]}),confirmed:model.confirmed};
}
export function fixtureCorners(f:RoomCad["fixtures"][number]) {
  const angle=f.rotation*Math.PI/180, cx=f.x+f.width/2,cy=f.y+f.depth/2;
  return [[-f.width/2,-f.depth/2],[f.width/2,-f.depth/2],[f.width/2,f.depth/2],[-f.width/2,f.depth/2]].map(([x,y])=>({x:cx+x*Math.cos(angle)-y*Math.sin(angle),y:cy+x*Math.sin(angle)+y*Math.cos(angle)}));
}
function inside(p:{x:number;y:number},outline:RoomCad["outline"]) {
  let inPolygon=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++) {
    const a=outline[j],b=outline[i],cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);
    if(Math.abs(cross)<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7)return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inPolygon=!inPolygon;
  }
  return inPolygon;
}
export function validateCad(raw:unknown):RoomCad {
  const m=cadSchema.parse(raw);validatePlan(cadPlan(m));
  const ids=[...m.openings,...m.fixtures].map(x=>x.id);
  if(new Set(ids).size!==ids.length)throw new Error("Use a unique ID for every object.");
  for(const o of m.openings){
    if(o.sill+o.height>m.height+1e-7)throw new Error("An opening extends above the ceiling.");
    if(o.kind==="door"&&o.sill!==0)throw new Error("Doors must start at floor level.");
    if(m.openings.some(p=>p.id!==o.id&&p.wall===o.wall&&Math.min(o.offset+o.width,p.offset+p.width)>Math.max(o.offset,p.offset)+1e-7&&Math.min(o.sill+o.height,p.sill+p.height)>Math.max(o.sill,p.sill)+1e-7))throw new Error("Openings overlap.");
  }
  for(const f of m.fixtures){
    if(f.z+f.height>m.height+1e-7)throw new Error(`${f.label} extends above the ceiling.`);
    if(!fixtureCorners(f).every(p=>inside(p,m.outline)))throw new Error(`${f.label} must fit inside the room.`);
    const corners=fixtureCorners(f);
    const cross=(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number})=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    for(let i=0;i<4;i++)for(let j=0;j<m.outline.length;j++){
      const a=corners[i],b=corners[(i+1)%4],c=m.outline[j],d=m.outline[(j+1)%m.outline.length];
      if(cross(a,b,c)*cross(a,b,d)<-1e-12&&cross(c,d,a)*cross(c,d,b)<-1e-12)throw new Error(`${f.label} crosses a wall.`);
    }
    for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];if(!inside({x:(a.x+b.x)/2,y:(a.y+b.y)/2},m.outline))throw new Error(`${f.label} crosses a wall.`);}

  }
  return m;
}
export function cadFromPlan(p:RoomPlan):RoomCad {
  const height=p.ceilingHeight||2.5;
  return validateCad({title:p.title,outline:p.outline,height,wallThickness:.15,floorColor:"#d9cfba",wallColor:"#e9e5dc",confirmed:!!p.confirmed,openings:p.openings.map((o,i)=>({id:`opening-${i+1}`,kind:o.kind,wall:o.wall,offset:o.offset,width:o.width,height:o.height||Math.min(o.kind==="door"?2.05:1.1,height),sill:o.kind==="door"?0:Math.min(.9,height-(o.height||1.1))})),fixtures:p.fixtures.map((f,i)=>({...f,id:`fixture-${i+1}`,shape:"box",z:0,height:.8,rotation:0,color:"#a8b7a1"})),assumptions:[...p.assumptions,...(!p.ceilingHeight?["Ceiling estimated at 2.5 m; correct in the room editor."]:[])].slice(0,12)});
}
