import type { RoomCad } from "./model";
export type WallSolid={wall:number;start:number;length:number;bottom:number;height:number};
/** Partition each wall around openings into disjoint solid cells. Metres, Z up. */
export function wallSolids(m:RoomCad):WallSolid[]{
 const result:WallSolid[]=[];
 m.outline.forEach((a,wall)=>{
  const b=m.outline[(wall+1)%m.outline.length],length=Math.hypot(b.x-a.x,b.y-a.y),open=m.openings.filter(o=>o.wall===wall);
  const xs=[...new Set([0,length,...open.flatMap(o=>[o.offset,o.offset+o.width])])].sort((a,b)=>a-b);
  const zs=[...new Set([0,m.height,...open.flatMap(o=>[o.sill,o.sill+o.height])])].sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
    if(!open.some(o=>x>o.offset&&x<o.offset+o.width&&z>o.sill&&z<o.sill+o.height))result.push({wall,start:xs[i],length:xs[i+1]-xs[i],bottom:zs[j],height:zs[j+1]-zs[j]});
  }
 });return result;
}
export function roomBounds(m:RoomCad){const xs=m.outline.map(p=>p.x),ys=m.outline.map(p=>p.y);return {minX:Math.min(...xs),minY:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...ys)-Math.min(...ys)};}
export function scaleRoom(m:RoomCad,width:number,depth:number):RoomCad{
 const b=roomBounds(m),sx=width/b.width,sy=depth/b.depth;
 return {...m,confirmed:false,outline:m.outline.map(p=>({x:b.minX+(p.x-b.minX)*sx,y:b.minY+(p.y-b.minY)*sy})),openings:m.openings.map(o=>{const a=m.outline[o.wall],c=m.outline[(o.wall+1)%m.outline.length],factor=Math.hypot((c.x-a.x)*sx,(c.y-a.y)*sy)/Math.hypot(c.x-a.x,c.y-a.y);return {...o,offset:o.offset*factor,width:o.width*factor};}),fixtures:m.fixtures.map(f=>({...f,x:b.minX+(f.x-b.minX)*sx,y:b.minY+(f.y-b.minY)*sy}))};
}
