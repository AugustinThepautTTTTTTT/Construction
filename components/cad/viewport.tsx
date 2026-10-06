"use client";
import { useEffect,useRef,useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { createCadWebGlRenderer } from "@/vendor/text-to-cad/webglRenderer.js";
import { RENDER_CAMERA_PRESETS } from "@/vendor/text-to-cad/camera.js";
import { createRoomScene,disposeRoomScene } from "@/lib/cad/scene";
import { roomBounds } from "@/lib/cad/geometry";
import { cadPlan,type RoomCad } from "@/lib/cad/model";
import { FloorPlan } from "@/components/room-artifact";
export type ViewportHandle={view:(name:string)=>void;export:(format:"glb"|"stl")=>Promise<void>};
function download(bytes:BlobPart,name:string,type:string){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function CadViewport({model,selection,onSelect,onMove,xray,dimensions,mode,apiRef}:{model:RoomCad;selection:string;onSelect:(id:string)=>void;onMove:(id:string,position:{x:number;y:number;z:number})=>void;xray:boolean;dimensions:boolean;mode:"select"|"move";apiRef:React.RefObject<ViewportHandle|null>}){
 const host=useRef<HTMLDivElement>(null),[unavailable,setUnavailable]=useState(false);
 const state=useRef({model,selection,onSelect,onMove,xray,dimensions,mode});state.current={model,selection,onSelect,onMove,xray,dimensions,mode};
 const runtime=useRef<{root:THREE.Group;scene:THREE.Scene;render:()=>void;transform:TransformControls;camera:THREE.PerspectiveCamera|THREE.OrthographicCamera;controls:OrbitControls;rebuild:(m:RoomCad)=>void;apply:()=>void}|null>(null);
 useEffect(()=>{
  if(!host.current)return;
  const el=host.current,scene=new THREE.Scene();
  let renderer:THREE.WebGLRenderer;
  try{renderer=createCadWebGlRenderer(THREE,{allowFallback:true,alpha:true,antialias:true,logarithmicDepthBuffer:false,preserveDrawingBuffer:true});}catch{setUnavailable(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf5f4ef,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute("aria-label","Interactive room CAD. Orbit by dragging, zoom with the scroll wheel; select or edit objects using the room inspector.");
  let camera:THREE.PerspectiveCamera|THREE.OrthographicCamera=new THREE.PerspectiveCamera(38,1,.01,500);camera.up.set(0,0,1);
  const controls=new OrbitControls(camera as THREE.Camera,renderer.domElement);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=.5;controls.maxDistance=150;
  scene.add(new THREE.HemisphereLight(0xffffff,0x8c9b7d,2.1));
  const sun=new THREE.DirectionalLight(0xfff9ef,1.8);sun.position.set(3,-4,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.bias=-.0002;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xe6f4ff,1.5);fill.position.set(-4,5,8);scene.add(fill);
  let root=createRoomScene(state.current.model);scene.add(root);
  let guides=new THREE.Group();scene.add(guides);
  const transform=new TransformControls(camera,renderer.domElement);transform.setMode("translate");transform.setTranslationSnap(.05);transform.setSize(.8);scene.add(transform.getHelper());
  const render=()=>renderer.render(scene,camera);
  const apply=()=>{
   root.traverse(obj=>{if(obj instanceof THREE.Mesh){const mat=obj.material as THREE.MeshStandardMaterial,id=obj.userData.id||"";if(id.startsWith("wall-")){mat.transparent=state.current.xray;mat.opacity=state.current.xray?.25:1;mat.depthWrite=!state.current.xray;obj.castShadow=!state.current.xray;}mat.emissive.set(id===state.current.selection?"#687b49":"#000000");mat.emissiveIntensity=id===state.current.selection?.12:0;}});
   const selected=root.children.find(o=>o.userData.id===state.current.selection);
   if(selected&&state.current.mode==="move"&&state.current.model.fixtures.some(f=>f.id===state.current.selection)){transform.attach(selected);transform.showZ=false;}else transform.detach();
   guides.visible=state.current.dimensions;render();
  };
  function rebuild(m:RoomCad){transform.detach();scene.remove(root);disposeRoomScene(root);root=createRoomScene(m);scene.add(root);scene.remove(guides);disposeRoomScene(guides);guides=new THREE.Group();scene.add(guides);
   const bounds=roomBounds(m),grid=new THREE.GridHelper(Math.max(bounds.width,bounds.depth)+4,Math.ceil(Math.max(bounds.width,bounds.depth)+4),0xc5ccbd,0xe2e5da);grid.rotateX(Math.PI/2);grid.position.set(bounds.minX+bounds.width/2,bounds.minY+bounds.depth/2,-.13);guides.add(grid);
   m.outline.forEach((a,i)=>{const b=m.outline[(i+1)%m.outline.length],c=document.createElement("canvas");c.width=300;c.height=80;const ctx=c.getContext("2d")!;ctx.font="500 32px Arial";ctx.textAlign="center";ctx.fillStyle="#56624c";ctx.fillText(`${m.confirmed?"":"≈ "}${Math.hypot(b.x-a.x,b.y-a.y).toFixed(2)} m`,150,48);const texture=new THREE.CanvasTexture(c),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.userData.labelTexture=texture;sprite.position.set((a.x+b.x)/2,(a.y+b.y)/2,.03);sprite.scale.set(1.3,.35,1);guides.add(sprite);});apply();
  }
  function view(name:string){camera=name==="iso"?new THREE.PerspectiveCamera(38,el.clientWidth/(el.clientHeight||450),.01,500):new THREE.OrthographicCamera(-5,5,5,-5,.01,500);controls.object=camera;transform.camera=camera;const b=roomBounds(state.current.model),target=new THREE.Vector3(b.minX+b.width/2,b.minY+b.depth/2,state.current.model.height*.2),preset=RENDER_CAMERA_PRESETS[name]||RENDER_CAMERA_PRESETS.iso,direction=new THREE.Vector3(...preset.direction as [number,number,number]).normalize(),distance=Math.max(b.width,b.depth,state.current.model.height)*2.2;camera.up.fromArray(preset.up as number[]);camera.position.copy(target).addScaledVector(direction,distance);controls.target.copy(target);controls.update();resize();render();}
  function resize(){const w=el.clientWidth,h=el.clientHeight||450;renderer.setSize(w,h);if(camera instanceof THREE.PerspectiveCamera)camera.aspect=w/h;else{const b=roomBounds(state.current.model),half=Math.max(b.width,b.depth,state.current.model.height)*.65;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;}camera.updateProjectionMatrix();render();}
  const observer=new ResizeObserver(resize);observer.observe(el);controls.addEventListener("change",render);transform.addEventListener("change",render);
  transform.addEventListener("dragging-changed",event=>{controls.enabled=!event.value;if(!event.value&&transform.object){const id=transform.object.userData.id,f=state.current.model.fixtures.find(f=>f.id===id);if(f)state.current.onMove(id,{x:transform.object.position.x-f.width/2,y:transform.object.position.y-f.depth/2,z:transform.object.position.z-f.height/2});}});
  const raycaster=new THREE.Raycaster();let down:{x:number;y:number}|null=null;
  const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
  const pointerUp=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||transform.dragging)return;const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects(root.children,false);const hit=(state.current.xray?hits.find(h=>!String(h.object.userData.id).startsWith("wall-")):hits[0])||hits[0];state.current.onSelect(hit?.object.userData.id||"");};
  renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointerup",pointerUp);
  runtime.current={root,scene,render,transform,camera,controls,rebuild,apply};
  apiRef.current={view,export:async format=>{const exportRoot=createRoomScene(state.current.model);try{if(format==="stl"){const bytes=new STLExporter().parse(exportRoot,{binary:true});download(bytes.buffer as ArrayBuffer,"roomwise-room.stl","model/stl");}else{const bytes=await new GLTFExporter().parseAsync(exportRoot,{binary:true,onlyVisible:true});download(bytes as ArrayBuffer,"roomwise-room.glb","model/gltf-binary");}}finally{disposeRoomScene(exportRoot);}}};
  rebuild(state.current.model);view("iso");resize();
  return()=>{observer.disconnect();controls.dispose();transform.dispose();disposeRoomScene(root);guides.traverse(o=>{if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}});disposeRoomScene(guides);renderer.dispose();renderer.forceContextLoss();el.replaceChildren();runtime.current=null;apiRef.current=null;};
 },[apiRef]);
 useEffect(()=>{runtime.current?.rebuild(model);},[model]);
 useEffect(()=>{runtime.current?.apply();},[selection,xray,dimensions,mode]);
 return <div className="cadViewport" ref={host}>{unavailable&&<div className="cadFallback"><FloorPlan plan={cadPlan(model)}/><p>3D needs WebGL in this browser. Your room remains editable below.</p></div>}</div>;
}
