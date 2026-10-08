import test from 'node:test';
import assert from 'node:assert/strict';
import * as profiles from '../lib/inspiration-library';
import * as execution from '../lib/work-assistant';
test('fixed reference selections resolve only catalogue IDs and produce a bounded design profile',()=>{
 assert.ok(profiles.INSPIRATIONS.length>=8);
 const selected=profiles.inspirationSelectionSchema.parse({ids:[profiles.INSPIRATIONS[0].id],skipped:false});
 const profile=profiles.inspirationProfile(selected.ids);
 assert.equal(profile.references.length,1);assert.ok(profile.palette.length);assert.throws(()=>profiles.inspirationProfile(['invented']));
 assert.equal(profiles.inspirationSelectionSchema.safeParse({ids:['bad'],skipped:false}).success,false);
 assert.equal(profiles.inspirationSelectionSchema.safeParse({ids:[],skipped:false}).success,false);
 assert.equal(profiles.inspirationSelectionSchema.safeParse({ids:[],skipped:true}).success,true);
});
const data={title:'Paint',workRevision:2,steps:[{title:'Prepare',instructions:['Clean'],checks:['Dry'],dependsOn:[],professionalRequired:false},{title:'Paint',instructions:['Roll'],checks:['Even'],dependsOn:[0],professionalRequired:false}],completedSteps:{0:true,1:true}};
test('reopening a prerequisite invalidates dependent completion while retaining all plan content',()=>{
 const result=execution.applyWorkUpdate(data,{index:0,checked:false,instructions:null,checks:null,note:'Reopened'});
 assert.equal(result.completedSteps[0],false);assert.equal(result.completedSteps[1],false);assert.equal(result.workRevision,3);assert.equal(result.steps[1].instructions[0],'Roll');assert.equal(data.completedSteps[0],true);
});
test('work instruction edits do not clear professional requirements and reset that step completion',()=>{
 const result=execution.applyWorkUpdate({...data,steps:[{...data.steps[0],professionalRequired:true},data.steps[1]]},{index:0,checked:null,instructions:['Professional to inspect'],checks:null,note:'Updated method'});
 assert.equal(result.steps[0].professionalRequired,true);assert.equal(result.completedSteps[0],false);assert.equal(result.completedSteps[1],false);
 assert.throws(()=>execution.applyWorkUpdate(data,{index:9,checked:true,instructions:null,checks:null,note:''}),/step/i);
});
test('a guidance-only turn cannot mutate the working plan before touching the database',async()=>{
 const {runRoomTool}=await import('../lib/artifact-store');
 await assert.rejects(()=>runRoomTool({query:async()=>{throw Error('database accessed');}} as any,'owner','room','update_work_plan',{}, {executionUpdate:false} as any),/not requested/);
});
test('fixed libraries are free, reusable and bound to their project owner; work updates reject stale revisions and other rooms',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {SCHEMA}=await import('../lib/repository');const {runRoomTool}=await import('../lib/artifact-store');
 const db=new PGlite();await db.exec(SCHEMA);const owner=crypto.randomUUID(),other=crypto.randomUUID(),room=crypto.randomUUID(),otherRoom=crypto.randomUUID(),plan=crypto.randomUUID();
 try{
 await db.query('INSERT INTO roomwise.users(id) VALUES($1),($2)',[owner,other]);
 await db.query("INSERT INTO roomwise.projects(id,user_id,title,brief) VALUES($1,$2,'Room','{}'),($3,$4,'Other','{}')",[room,owner,otherRoom,other]);
 const first=await runRoomTool(db as any,owner,room,'open_inspiration_library',{room:'Bathroom'},{inspiration:true});
 const again=await runRoomTool(db as any,owner,room,'open_inspiration_library',{room:'Kitchen'},{inspiration:true});assert.equal(first.id,again.id);assert.equal((await db.query('SELECT * FROM roomwise.credit_ledger')).rows.length,0);
 await assert.rejects(()=>runRoomTool(db as any,other,room,'open_inspiration_library',{room:'All'},{inspiration:true}),/Room not found/);
 await db.query("INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data) VALUES($1,$2,$3,'construction',$4::jsonb)",[plan,owner,room,JSON.stringify(data)]);
 const edit={index:0,checked:false,instructions:null,checks:null,note:'Reopened'};
 await assert.rejects(()=>execution.updateWorkPlan(db as any,other,room,plan,edit,2),/not found/);
 await assert.rejects(()=>execution.updateWorkPlan(db as any,owner,otherRoom,plan,edit,2),/not found/);
 await execution.updateWorkPlan(db as any,owner,room,plan,edit,2);
 await assert.rejects(()=>execution.updateWorkPlan(db as any,owner,room,plan,edit,2),/changed/);
 assert.equal((await db.query<{data:any}>('SELECT data FROM roomwise.artifacts WHERE id=$1',[plan])).rows[0].data.workRevision,3);
 }finally{await db.close();}
});
test('inspiration is interactive and guidance keeps drying times, dependencies, professional flags and saved progress in context',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {InspirationLibrary}=await import('../components/inspiration-library');
 const html=renderToStaticMarkup(React.createElement(InspirationLibrary,{artifact:{id:'reference',data:{room:'Bathroom',selectedIds:[]}} as any,onChanged:()=>{}}));
 assert.match(html,/Search inspiration/);assert.match(html,/Skip for now/);assert.match(html,/Use these references/);assert.match(html,/\/inspiration\/bathroom.jpg/);assert.doesNotMatch(html,/\/api\/.*image/);
 const context=execution.workContext({...data,steps:data.steps.map(step=>({...step,dryingTime:'24 hours'}))},'How to do step 2?');
 assert.equal(context.workRevision,2);assert.equal(context.steps[1].dryingTime,'24 hours');assert.deepEqual(context.steps[1].dependsOn,[0]);assert.equal(context.completedSteps[0],true);
});
test('a routing outage cannot open inspiration or update work and image prompts receive fixed preference context',async()=>{
 const {classifyChatIntent}=await import('../lib/chat-harness');const {roomVisualPrompt}=await import('../lib/room-visual');
 const result=await classifyChatIntent({responses:{create:async()=>{throw Error('outage');}}} as any,'model','Thanks',[],[]);
 assert.equal(result.intent.inspiration,'none');assert.equal(result.intent.executionUpdate,false);
 const prompt=roomVisualPrompt({title:'Design',sourcePhotoId:'photo',brief:'Refresh',retain:['Original walls'],changes:['Colour'],inspirationProfile:profiles.inspirationProfile([profiles.INSPIRATIONS[0].id])} as any);
 assert.match(prompt,/bathroom-spa/);assert.match(prompt,/never permission to copy/);
});
test('saved image data is narrowed for rendering without dropping its validated reference profile',async()=>{
 const {parseVisualForRendering}=await import('../lib/room-visual');
 const saved={title:'Design',sourcePhotoId:crypto.randomUUID(),brief:'A warm room refresh',retain:['Walls'],changes:['Paint'],visualAuthorized:true,inspirationProfile:profiles.inspirationProfile([profiles.INSPIRATIONS[0].id])};
 const visual=parseVisualForRendering(saved);assert.equal(visual.inspirationProfile!.references[0].id,'bathroom-spa');assert.equal('visualAuthorized' in visual,false);
});
