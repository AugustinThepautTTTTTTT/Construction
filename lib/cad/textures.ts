import * as THREE from "three";
import { MATERIALS,type MaterialId } from "./appearance";
// Local repeatable swatches: no remote assets, image calls or tracking.
export function finishMaterial(id:MaterialId,color:string){
 const profile=MATERIALS.find(m=>m.id===id)!;
 const material=new THREE.MeshStandardMaterial({color,roughness:profile.roughness,metalness:profile.metalness,side:THREE.DoubleSide});
 if(id==="paint"||id==="metal"||typeof document==="undefined")return material;
 const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const ctx=canvas.getContext("2d");if(!ctx)return material;
 ctx.fillStyle="#e9e9e9";ctx.fillRect(0,0,256,256);
 let seed=49;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<6500;i++){const shade=210+Math.floor(random()*38);ctx.fillStyle=`rgba(${shade},${shade},${shade},.35)`;ctx.fillRect(random()*256,random()*256,id==="oak"?1:2,id==="oak"?12+random()*65:2);}
 if(id==="tile"){ctx.strokeStyle="#969696";ctx.lineWidth=2;ctx.strokeRect(0,0,256,256);}
 if(id==="oak"){ctx.strokeStyle="#9f9f9f";ctx.lineWidth=2;ctx.strokeRect(0,0,256,256);for(let i=0;i<35;i++){ctx.strokeStyle=`rgba(130,130,130,${random()*.2})`;ctx.beginPath();const x=random()*256;ctx.moveTo(x,0);ctx.bezierCurveTo(x+10,85,x-10,180,x,256);ctx.stroke();}}
 if(id==="stone"){ctx.strokeStyle="#aaaaaa";ctx.lineWidth=.7;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(random()*256,0);ctx.bezierCurveTo(random()*256,75,random()*256,170,random()*256,256);ctx.stroke();}}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(id==="oak"?5:1.65,id==="oak"?.8:1.65);map.anisotropy=4;material.map=map;
 return material;
}
export function surfaceUV(geometry:THREE.BufferGeometry,kind:"floor"|"wall"|"fixture",offset={x:0,z:0}){
 const p=geometry.getAttribute("position"),normal=geometry.getAttribute("normal"),uv=geometry.getAttribute("uv");if(!uv)return;
 for(let i=0;i<p.count;i++){if(kind==="floor")uv.setXY(i,p.getX(i),p.getY(i));else if(kind==="wall")uv.setXY(i,p.getX(i)+offset.x,p.getZ(i)+offset.z);else if(Math.abs(normal.getZ(i))>.5)uv.setXY(i,p.getX(i),p.getY(i));else uv.setXY(i,Math.abs(normal.getY(i))>.5?p.getX(i):p.getY(i),p.getZ(i));}uv.needsUpdate=true;
}
