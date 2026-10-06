import { fixtureGeometry,addFixtureDetails } from "./fixture-details";
import { materialFor } from "./appearance";
import { finishMaterial,surfaceUV } from "./textures";
import * as THREE from "three";
import { wallSolids, roomBounds } from "./geometry";
import type { RoomCad } from "./model";
export function createRoomScene(m:RoomCad){
 const root=new THREE.Group();root.name=m.title;
 function mesh(id:string,label:string,geometry:THREE.BufferGeometry,color:string,position:THREE.Vector3,rotation=0){
  const material=finishMaterial(materialFor(m,id),color);
  const part=new THREE.Mesh(geometry,material);part.name=label;part.userData.id=id;part.position.copy(position);part.rotation.z=rotation;part.castShadow=true;part.receiveShadow=true;
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),new THREE.LineBasicMaterial({color:"#506151",transparent:true,opacity:.28}));edges.userData.decoration=true;edges.visible=false;part.add(edges);root.add(part);return part;
 }
 const floor=new THREE.Shape(m.outline.map(p=>new THREE.Vector2(p.x,p.y)));
 const floorGeometry=new THREE.ExtrudeGeometry(floor,{depth:.12,bevelEnabled:false});floorGeometry.translate(0,0,-.12);
 surfaceUV(floorGeometry,"floor");
 mesh("floor","Floor",floorGeometry,m.floorColor,new THREE.Vector3());
 for(const w of wallSolids(m)){
  const a=m.outline[w.wall],b=m.outline[(w.wall+1)%m.outline.length],angle=Math.atan2(b.y-a.y,b.x-a.x),t=w.start+w.length/2;
  const geometry=new THREE.BoxGeometry(w.length,m.wallThickness,w.height);surfaceUV(geometry,"wall",{x:t,z:w.bottom+w.height/2});
  mesh(`wall-${w.wall}`,`Wall ${w.wall+1}`,geometry,m.wallColor,new THREE.Vector3(a.x+Math.cos(angle)*t,a.y+Math.sin(angle)*t,w.bottom+w.height/2),angle);
 }
 for(const o of m.openings){
  const a=m.outline[o.wall],b=m.outline[(o.wall+1)%m.outline.length],angle=Math.atan2(b.y-a.y,b.x-a.x),t=o.offset+o.width/2;
  const part=mesh(o.id,o.kind==="window"?"Window":"Door",new THREE.BoxGeometry(o.width,.035,o.height),o.kind==="window"?"#97c5cc":"#bda681",new THREE.Vector3(a.x+Math.cos(angle)*t,a.y+Math.sin(angle)*t,o.sill+o.height/2),angle);
  (part.material as THREE.MeshStandardMaterial).transparent=true;(part.material as THREE.MeshStandardMaterial).opacity=o.kind==="window"?.28:.35;
 }
 for(const f of m.fixtures){
  const geom=fixtureGeometry(f);
  surfaceUV(geom,"fixture");
  const part=mesh(f.id,f.label,geom,f.color,new THREE.Vector3(f.x+f.width/2,f.y+f.depth/2,f.z+f.height/2),f.rotation*Math.PI/180);addFixtureDetails(part,f);
 }
 return root;
}
export function disposeRoomScene(root:THREE.Object3D){root.traverse(obj=>{if(obj instanceof THREE.Sprite){obj.material.map?.dispose();obj.material.dispose();}
if(obj instanceof THREE.Mesh||obj instanceof THREE.LineSegments){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(mat=>{if(mat instanceof THREE.MeshStandardMaterial)mat.map?.dispose();mat.dispose();});}});}
