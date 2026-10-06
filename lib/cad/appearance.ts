import type { RoomCad } from "./model";
export const MATERIALS = [
 {id:"paint",name:"Soft paint",color:"#eee9df",roughness:.92,metalness:0},
 {id:"oak",name:"Natural oak",color:"#b88c60",roughness:.65,metalness:0},
 {id:"tile",name:"Ceramic tile",color:"#d6d0c4",roughness:.3,metalness:0},
 {id:"stone",name:"Warm stone",color:"#d0c2ab",roughness:.78,metalness:0},
 {id:"concrete",name:"Microcement",color:"#a8aaa3",roughness:.85,metalness:0},
 {id:"metal",name:"Brushed metal",color:"#aeb6b9",roughness:.28,metalness:.8},
] as const;
export type MaterialId = typeof MATERIALS[number]["id"];
export const LIGHTING = [
 {id:"daylight",name:"Daylight",description:"Clear, soft natural light",color:"#f4f7ff",sun:2,ambient:1.8,fill:1.2,exposure:1},
 {id:"golden",name:"Golden hour",description:"Low sunshine and warm shadows",color:"#ffd7a0",sun:2.5,ambient:1.15,fill:.7,exposure:1},
 {id:"evening",name:"Evening",description:"Warm lamps, a quieter atmosphere",color:"#ffcb85",sun:.25,ambient:.55,fill:.45,exposure:1.1},
 {id:"studio",name:"Soft studio",description:"Even lighting to compare finishes",color:"#ffffff",sun:.8,ambient:2,fill:1.5,exposure:1},
] as const;
export type LightingId = typeof LIGHTING[number]["id"];
export function roomAppearance(model:RoomCad){return model.appearance || {floor:"paint" as MaterialId,wall:"paint" as MaterialId,fixtures:[],lighting:"daylight" as LightingId,brightness:1};}
export function materialFor(model:RoomCad,id:string):MaterialId {const a=roomAppearance(model);return id==="floor"?a.floor:id.startsWith("wall-")?a.wall:a.fixtures.find(f=>f.id===id)?.material||"paint";}
export function applyFinish(model:RoomCad,id:string,material:MaterialId):RoomCad {
 const a=roomAppearance(model),color=MATERIALS.find(m=>m.id===material)!.color;
 if(id==="floor")return {...model,floorColor:color,appearance:{...a,floor:material}};
 if(id.startsWith("wall-")||id==="walls")return {...model,wallColor:color,appearance:{...a,wall:material}};
 return {...model,fixtures:model.fixtures.map(f=>f.id===id?{...f,color}:f),appearance:{...a,fixtures:[...a.fixtures.filter(f=>f.id!==id),{id,material}].slice(-30)}};
}
