import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import * as THREE from 'three';
import {STLExporter} from 'three/examples/jsm/exporters/STLExporter.js';
import {SCHEMA,ProjectRepository} from '../lib/repository';
import {briefSchema} from '../lib/domain';
import {cadPlan,validateCad,type RoomCad} from '../lib/cad/model';
import {getCad,saveCad,cadHistory,cadAtRevision,CadConflict} from '../lib/cad/store';
import {wallSolids,scaleRoom} from '../lib/cad/geometry';
import {createRoomScene,disposeRoomScene} from '../lib/cad/scene';
import {cadPythonSource} from '../lib/cad/source-export';
import {roomMetrics,calculateEstimate} from '../lib/room-artifacts';
import {runRoomTool} from '../lib/artifact-store';
import {RENDER_CAMERA_PRESETS} from '../vendor/text-to-cad/camera.js';
const room:RoomCad={title:'Room',outline:[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}],height:2.5,wallThickness:.15,floorColor:'#d9cfba',wallColor:'#e9e5dc',confirmed:false,openings:[{id:'door',kind:'door',wall:0,offset:.5,width:.8,height:2,sill:0},{id:'window',kind:'window',wall:1,offset:.8,width:1.2,height:1.1,sill:.9}],fixtures:[{id:'vanity',label:'Vanity',shape:'box',x:2,y:1,z:0,width:.8,depth:.5,height:.85,rotation:0,color:'#a8b7a1'}],assumptions:['Photo estimate']};
test('CAD rejects overlapping openings, duplicate IDs, rotated wall crossings and heights outside the room',()=>{
 assert.equal(validateCad(room).height,2.5);
 assert.throws(()=>validateCad({...room,openings:[...room.openings,{...room.openings[0],id:'door2',offset:.7}]}),/overlap/);
 assert.throws(()=>validateCad({...room,fixtures:[{...room.fixtures[0],id:'door'}]}),/unique/);
 assert.throws(()=>validateCad({...room,fixtures:[{...room.fixtures[0],x:0,y:0,rotation:45}]}),/fit/);
 assert.throws(()=>validateCad({...room,openings:[{...room.openings[1],sill:2}]}),/ceiling/);
});
test('CAD solid walls contain actual door/window holes and supply the canonical net surfaces',()=>{
 const solids=wallSolids(room),area=solids.reduce((n,w)=>n+w.length*w.height,0),net=roomMetrics(cadPlan(room));
 assert.ok(Math.abs(area-(14*2.5-.8*2-1.2*1.1))<1e-8);
 assert.ok(Math.abs(area-net.wallArea!)<1e-8);
 for(const o of room.openings)assert.equal(solids.some(s=>s.wall===o.wall&&s.start<o.offset+o.width-1e-8&&s.start+s.length>o.offset+1e-8&&s.bottom<o.sill+o.height-1e-8&&s.bottom+s.height>o.sill+1e-8),false);
 const resized=validateCad(scaleRoom(room,5,3));assert.equal(roomMetrics(cadPlan(resized)).area,15);
});
test('CAD saves atomic revisions, protects owners, rejects stale concurrent edits and restores without erasing history',async()=>{
 const db=new PGlite();await db.exec(SCHEMA);const owner=randomUUID(),other=randomUUID();await db.query('INSERT INTO roomwise.users(id,email) VALUES($1,$2),($3,$4)',[owner,'cad@test.com',other,'other@test.com']);
 const project=await new ProjectRepository(db as any).create(owner,briefSchema.parse({room:'Bathroom',goal:'Create CAD'}));
 const first=await saveCad(db as any,owner,project.id,0,room,'ai','From photos');assert.equal(first.revision,1);
 assert.equal(await getCad(db as any,other,project.id),null);assert.equal((await cadHistory(db as any,other,project.id)).length,0);assert.equal(await cadAtRevision(db as any,other,project.id,1),null);
 await assert.rejects(()=>saveCad(db as any,other,project.id,1,room,'user','Foreign edit'),/not found/);
 const edits=await Promise.allSettled([saveCad(db as any,owner,project.id,1,{...room,height:2.6},'user','Ceiling correction'),saveCad(db as any,owner,project.id,1,{...room,height:2.7},'ai','Stale AI edit')]);
 assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);assert.ok(edits.some(r=>r.status==='rejected'&&r.reason instanceof CadConflict));
 const before=(await getCad(db as any,owner,project.id))!;assert.equal(before.revision,2);
 const restored=await saveCad(db as any,owner,project.id,2,(await cadAtRevision(db as any,owner,project.id,1))!,'user','Restore');assert.equal(restored.revision,3);assert.equal(restored.model.height,2.5);assert.equal((await cadHistory(db as any,owner,project.id)).length,3);
 const tool=await runRoomTool(db as any,owner,project.id,'update_room_cad',{baseRevision:3,model:{...room,height:2.8,confirmed:true},changeSummary:'Raise ceiling'});assert.equal(tool.kind,'cad');assert.equal((await getCad(db as any,owner,project.id))?.model.confirmed,false);
 await db.close();
});
test('viewer preserves stable selectable IDs and exports real STL triangles; upstream camera uses CAD Z-up',()=>{
 const scene=createRoomScene(room);assert.ok(scene.children.some(x=>x.userData.id==='vanity'));assert.ok(scene.children.some(x=>x.userData.id==='window'));
 scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scene);assert.equal(bounds.max.z,2.5);
 const bytes=new STLExporter().parse(scene,{binary:true});assert.ok(bytes.byteLength>84);assert.ok(bytes.getUint32(80,true)>20);
 assert.deepEqual(RENDER_CAMERA_PRESETS.iso.up,[0,0,1]);assert.deepEqual(RENDER_CAMERA_PRESETS.top.direction,[0,0,1]);disposeRoomScene(scene);
});
test('portable CAD source safely encodes untrusted labels and uses the upstream cadgen native export contract',()=>{
 const source=cadPythonSource({...room,title:"x''' __import__('os')",fixtures:[{...room.fixtures[0],label:"'); import os; #"}]});
 assert.match(source,/from cadgen import step/);assert.match(source,/@step\(out="room.step"\)/);assert.doesNotMatch(source,/__import__|import os/);assert.match(source,/base64.b64decode/);
});
