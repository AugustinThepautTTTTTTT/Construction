import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {isLayoutRequest} from '../lib/project-intent';
import {projectGeometry} from '../lib/project-geometry';
import {projectAssets} from '../lib/project-assets';
import {materialPresentation,productUrl} from '../lib/material-presentation';
import {SCHEMA,ProjectRepository} from '../lib/repository';
import {briefSchema} from '../lib/domain';
import {runRoomTool} from '../lib/artifact-store';
import {skillTools} from '../lib/skill-registry';
import type {Artifact} from '../lib/room-artifacts';
test('refurbishment, retained geometry and shopping stay out of CAD; explicit spatial changes route to layout',()=>{
 for(const message of ['Repaint the walls and show me a warmer bathroom','Find a sofa under 500 euros','Keep the layout, change the floor and vanity finish','No structural changes, make the room brighter','Refurbish the room without changing the layout','A new look using the same layout','Remove tiles on the wall and repaint','Conserver les murs, changer le carrelage'])assert.equal(isLayoutRequest(message),false,message);
 for(const message of ['Remove the partition wall','Move the sofa next to the window','Show me a floor plan','Keep the windows but break the wall','Ajouter un meuble devant la fenêtre','Change the layout without moving the walls'])assert.equal(isLayoutRequest(message),true,message);
 assert.equal(isLayoutRequest('Move it 20 cm left',true),true);
 assert.equal(skillTools({layout:false}).some(t=>t.name==='update_room_cad'),false);
 assert.equal(skillTools({layout:true}).some(t=>t.name==='update_room_cad'),true);
});
test('material presentation separates sourced subtotals from allowances and never links unsafe URLs',()=>{
 const a={id:randomUUID(),kind:'estimate',status:'ready',created_at:new Date().toISOString(),data:{currency:'EUR',calculations:{items:[{index:0,quantity:2,low:10,high:30},{index:1,quantity:1,low:25,high:35}]},priceSources:[{index:0,price:20,url:'https://www.leroymerlin.fr/produits/peinture.html',title:'Paint'}]}} as Artifact;
 const bill=materialPresentation(a);assert.equal(bill.sourced,40);assert.equal(bill.allowanceLow,25);assert.equal(bill.allowanceHigh,35);assert.equal(bill.low,65);assert.equal(bill.high,75);assert.equal(bill.verifiedCount,1);
 assert.equal(productUrl('javascript:alert(1)'),null);assert.equal(productUrl('https://user:password@example.com/x'),null);
 assert.equal(materialPresentation({...a,data:{...a.data,priceSources:[{index:0,price:20,url:'javascript:alert(1)'}]}}).verifiedCount,0);
});
test('project folders are owner scoped, return metadata without photo bytes, recalculate quantities, and queue new visuals',async()=>{
 const db=new PGlite();await db.exec(SCHEMA);const owner=randomUUID(),other=randomUUID();await db.query('INSERT INTO roomwise.users(id,email) VALUES($1,$2),($3,$4)',[owner,'folder@test.com',other,'foreign@test.com']);
 const repo=new ProjectRepository(db as any),p=await repo.create(owner,briefSchema.parse({room:'Bathroom',goal:'Refurbish'})),photo=randomUUID();await db.query('INSERT INTO roomwise.photos(id,user_id,project_id,data) VALUES($1,$2,$3,$4)',[photo,owner,p.id,Buffer.from('PRIVATE_PHOTO_BYTES')]);
 const visual=await runRoomTool(db as any,owner,p.id,'prepare_room_visual',{title:'Warm room',sourcePhotoId:photo,brief:'Warm finishes with existing geometry',retain:['Walls'],changes:['Paint']});
 const geometry={title:'Measured room',outline:[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}],ceilingHeight:2.5,openings:[],fixtures:[],surfaces:[],assumptions:[],questions:[],confirmed:true};
 await db.query("INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data) VALUES($1,$2,$3,'plan',$4::jsonb)",[randomUUID(),owner,p.id,JSON.stringify(geometry)]);
 const bill={title:'Floor',country:'FR',city:'Mulhouse',currency:'EUR',items:[{item:'Tile',specification:'Ceramic tile',basis:'floor_area',manualQuantity:null,unit:'pack',coveragePerUnit:2,coats:1,waste:0,priceLow:20,priceHigh:30}],assumptions:[],exclusions:[],calculations:{items:[],low:0,high:0}};
 await db.query("INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data) VALUES($1,$2,$3,'estimate',$4::jsonb)",[randomUUID(),owner,p.id,JSON.stringify(bill)]);
 const assets=(await projectAssets(db as any,owner,p.id))!;assert.equal(assets.artifacts.find(a=>a.id===visual.id)?.status,'queued');assert.equal(assets.photos.length,1);assert.equal(assets.artifacts.some(a=>a.kind==='plan'),false);assert.equal(JSON.stringify(assets).includes('PRIVATE_PHOTO_BYTES'),false);assert.equal(assets.artifacts.find(a=>a.kind==='estimate')?.data.calculations.items[0].quantity,6);assert.equal(await projectAssets(db as any,other,p.id),null);assert.deepEqual((await projectGeometry(db as any,owner,p.id))?.plan,geometry);assert.equal(await projectGeometry(db as any,other,p.id),null);
 await db.query("UPDATE roomwise.artifacts SET status='running',data=data || $2::jsonb WHERE id=$1",[visual.id,JSON.stringify({startedAt:new Date(Date.now()-7*60*1000).toISOString()})]);assert.equal((await projectAssets(db as any,owner,p.id))?.artifacts.find(a=>a.id===visual.id)?.status,'failed');assert.equal((await db.query<{status:string}>('SELECT status FROM roomwise.artifacts WHERE id=$1',[visual.id])).rows[0].status,'running');await db.close();
});
