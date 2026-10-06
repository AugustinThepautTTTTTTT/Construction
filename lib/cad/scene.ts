import * as THREE from "three";
import { wallSolids, roomBounds } from "./geometry";
import type { RoomCad } from "./model";
export function createRoomScene(m:RoomCad){
 const root=new THREE.Group();root.name=m.title;
 function mesh(id:string,label:string,geometry:THREE.BufferGeometry,color:string,position:THREE.Vector3,rotation=0){
  const material=new THREE.MeshStandardMaterial({color,roughness:.85,metalness:.02});
  const part=new THREE.Mesh(geometry,material);part.name=label;part.userData.id=id;part.position.copy(position);part.rotation.z=rotation;part.castShadow=true;part.receiveShadow=true;
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),new THREE.LineBasicMaterial({color:"#506151",transparent:true,opacity:.28}));edges.userData.decoration=true;part.add(edges);root.add(part);return part;
 }
 const floor=new THREE.Shape(m.outline.map(p=>new THREE.Vector2(p.x,p.y)));
 const floorGeometry=new THREE.ExtrudeGeometry(floor,{depth:.12,bevelEnabled:false});floorGeometry.translate(0,0,-.12);
 mesh("floor","Floor",floorGeometry,m.floorColor,new THREE.Vector3());
 for(const w of wallSolids(m)){
  const a=m.outline[w.wall],b=m.outline[(w.wall+1)%m.outline.length],angle=Math.atan2(b.y-a.y,b.x-a.x),t=w.start+w.length/2;
  mesh(`wall-${w.wall}`,`Wall ${w.wall+1}`,new THREE.BoxGeometry(w.length,m.wallThickness,w.height),m.wallColor,new THREE.Vector3(a.x+Math.cos(angle)*t,a.y+Math.sin(angle)*t,w.bottom+w.height/2),angle);
 }
 for(const o of m.openings){
  const a=m.outline[o.wall],b=m.outline[(o.wall+1)%m.outline.length],angle=Math.atan2(b.y-a.y,b.x-a.x),t=o.offset+o.width/2;
  const part=mesh(o.id,o.kind==="window"?"Window":"Door",new THREE.BoxGeometry(o.width,.035,o.height),o.kind==="window"?"#97c5cc":"#bda681",new THREE.Vector3(a.x+Math.cos(angle)*t,a.y+Math.sin(angle)*t,o.sill+o.height/2),angle);
  (part.material as THREE.MeshStandardMaterial).transparent=true;(part.material as THREE.MeshStandardMaterial).opacity=o.kind==="window"?.28:.35;
 }
 for(const f of m.fixtures){
  const geom=f.shape==="cylinder"?new THREE.CylinderGeometry(f.width/2,f.width/2,f.height,40):new THREE.BoxGeometry(f.width,f.depth,f.height);
  if(f.shape==="cylinder"){geom.rotateX(Math.PI/2);geom.scale(1,f.depth/f.width,1);}
  mesh(f.id,f.label,geom,f.color,new THREE.Vector3(f.x+f.width/2,f.y+f.depth/2,f.z+f.height/2),f.rotation*Math.PI/180);
 }
 return root;
}
export function disposeRoomScene(root:THREE.Object3D){root.traverse(obj=>{if(obj instanceof THREE.Sprite){obj.material.map?.dispose();obj.material.dispose();}
if(obj instanceof THREE.Mesh||obj instanceof THREE.LineSegments){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(mat=>mat.dispose());}});}
