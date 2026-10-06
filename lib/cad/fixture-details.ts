import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RoomCad } from "./model";
type Fixture=RoomCad["fixtures"][number];
const toilet=(f:Fixture)=>/toilet|\bwc\b|toilette/i.test(f.label);
const cabinet=(f:Fixture)=>/vanity|cabinet|dresser|meuble|vasque/i.test(f.label);
export function fixtureGeometry(f:Fixture){
 if(toilet(f)){
  const tank=new THREE.BoxGeometry(f.width*.8,f.depth*.28,f.height*.9);tank.translate(0,f.depth*.32,f.height*.05);
  const bowl=new THREE.SphereGeometry(1,32,20);bowl.scale(f.width*.5,f.depth*.4,f.height*.26);bowl.translate(0,-f.depth*.1,-f.height*.05);
  const pedestal=new THREE.CylinderGeometry(f.width*.3,f.width*.25,f.height*.45,32);pedestal.rotateX(Math.PI/2);pedestal.translate(0,-f.depth*.02,-f.height*.275);
  const parts=[tank,bowl,pedestal].map(g=>g.toNonIndexed()),result=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());[tank,bowl,pedestal].forEach(g=>g.dispose());return result;
 }
 if(cabinet(f)){const g=new THREE.BoxGeometry(f.width,f.depth,f.height*.85);g.translate(0,0,-f.height*.075);return g;}
 const g=f.shape==="cylinder"?new THREE.CylinderGeometry(f.width/2,f.width/2,f.height,40):new THREE.BoxGeometry(f.width,f.depth,f.height);
 if(f.shape==="cylinder"){g.rotateX(Math.PI/2);g.scale(1,f.depth/f.width,1);}return g;
}
// Recognizable layout proxies, never manufacturer or fabrication geometry.
export function addFixtureDetails(part:THREE.Mesh,f:Fixture){
 function add(name:string,g:THREE.BufferGeometry,color:string,x:number,y:number,z:number,metalness=0){const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:metalness?.3:.55,metalness}));m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;part.add(m);return m;}
 if(toilet(f)){
  const ring=new THREE.TorusGeometry(1,.16,12,48);ring.scale(f.width*.36,f.depth*.29,f.height*.025);add("Seat",ring,"#f4f1e9",0,-f.depth*.1,f.height*.21);
  const inner=new THREE.CircleGeometry(1,40);inner.scale(f.width*.26,f.depth*.21,1);add("Bowl interior",inner,"#b8bcb5",0,-f.depth*.1,f.height*.211);
 }else if(/washer|washing|lave.?linge|machine à laver/i.test(f.label)){
  const radius=Math.min(f.width,f.height)*.29,ring=new THREE.TorusGeometry(radius,radius*.15,12,48);ring.rotateX(Math.PI/2);add("Drum surround",ring,"#c2cbc8",0,-f.depth/2-.005,-f.height*.04,.65);
  const glass=new THREE.CylinderGeometry(radius*.83,radius*.83,.007,40);add("Drum glass",glass,"#2e3c3f",0,-f.depth/2-.007,-f.height*.04,.3);
  add("Control strip",new THREE.BoxGeometry(f.width*.88,.008,f.height*.08),"#d9ddd6",0,-f.depth/2-.003,f.height*.37);
 }else if(cabinet(f)){
  add("Countertop",new THREE.BoxGeometry(f.width,f.depth,f.height*.06),"#e8e5de",0,0,f.height*.38);
  for(const x of [-f.width*.24,f.width*.24])add("Brushed pull",new THREE.BoxGeometry(f.width*.15,.018,.012),"#b0bab5",x,-f.depth/2-.005,f.height*.18,.65);
  const line=new THREE.BoxGeometry(.005,.006,f.height*.74);add("Door seam",line,"#67705e",0,-f.depth/2-.002,-f.height*.075);
  if(/vanity|vasque/i.test(f.label)){const rim=new THREE.TorusGeometry(1,.12,12,48);rim.scale(f.width*.24,f.depth*.26,f.height*.04);add("Basin rim",rim,"#f7f5ec",0,0,f.height*.44);const bowl=new THREE.CircleGeometry(1,48);bowl.scale(f.width*.21,f.depth*.22,1);add("Basin",bowl,"#cdd3cb",0,0,f.height*.435);}
 }
}
