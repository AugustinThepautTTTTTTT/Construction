import test from 'node:test';
import assert from 'node:assert/strict';
import {skillTools} from '../lib/skill-registry';
import {isVisualRequest,implementationRequest,visualRequestedForArtifact} from '../lib/project-intent';
import {runRoomTool} from '../lib/artifact-store';

test('materials and work requests cannot dispatch the image tool',()=>{
 const names=skillTools({layout:false,products:false,paid:true,visuals:false} as any).map(t=>t.name);
 assert.equal(names.includes('prepare_room_visual'),false);
 assert.equal(names.includes('create_material_estimate'),true);
 assert.equal(names.includes('create_construction_plan'),true);
});

test('an existing photo concept does not authorize an image for the next implementation request',()=>{
 const history=[{role:'user',content:'Modernize my living room'},{role:'assistant',content:'I saved your new room concept.'}];
 for(const message of ['Make a list of materials and working steps so that i can start shopping and building it','Give me the bill of materials','Give me the bill of materials for the new image','I want the bill of materials based on this image','Fais la liste des matériaux et les étapes des travaux','Find actual products for this design','What quantities do I need for this image?','What condition is the floor in?','Thanks']){
  assert.equal(isVisualRequest(message,history),false,message);
  assert.equal(skillTools({layout:false,products:false,paid:true,visuals:isVisualRequest(message,history)}).some(t=>t.name==='prepare_room_visual'),false);
 }
 assert.deepEqual(implementationRequest(history[0].content),{materials:false,construction:false});
 assert.deepEqual(implementationRequest('Make a list of materials and working steps so that i can start shopping and building it'),{materials:true,construction:true});
});

test('image requests, design changes and direct offer acceptance still generate automatically',()=>{
 for(const message of ['Generate an image','Modernize my living room','Make the walls blue','Je veux un visuel de la cuisine','Create a bill of materials and generate a new image','I want a concept image','Show the renovation concept'])assert.equal(isVisualRequest(message),true,message);
 assert.equal(isVisualRequest('Yes please',[{role:'assistant',content:'Would you like me to generate a concept image?'}]),true);
 assert.equal(isVisualRequest('Yes please',[{role:'assistant',content:'Would you like me to create the bill of materials?'}]),false);
});

test('explicit image refusals cannot trigger a paid generation',()=>{
 for(const message of ['Do not generate an image; give me the bill of materials','I don’t want another image','Modernize my room without generating images','Pas de nouveau visuel, fais la liste des matériaux'])assert.equal(isVisualRequest(message),false,message);
});

test('a queued image attached to a materials-only reply is rejected before any database write',async()=>{
 let queries=0;const db:any={query:async()=>{queries++;return {rows:[]};}};
 await assert.rejects(()=>runRoomTool(db,'owner','project','prepare_room_visual',{}, {visuals:false}),/do not create an image/);assert.equal(queries,0);
 assert.equal(visualRequestedForArtifact([{role:'user',content:'Make a list of materials and working steps'},{role:'assistant',content:'Saved a concept',artifactIds:['bad-image']}],'bad-image'),false);
 assert.equal(visualRequestedForArtifact([{role:'user',content:'Generate an image'},{role:'assistant',content:'Saved a concept',artifactIds:['good-image']}],'good-image'),true);
});
