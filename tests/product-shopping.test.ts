import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingEstimate,addShoppingSelection} from '../lib/product-shopping';
import {materialBills} from '../lib/material-bills';
import {skillTools} from '../lib/skill-registry';
const input={estimateId:'11111111-1111-4111-8111-111111111111',item:'Floor tiles',specification:'Matt warm stone bathroom floor tiles',unit:'m2',quantity:null,preferences:''};
const draft=shoppingEstimate(input,{city:'Mulhouse',country:'FR',currency:'EUR'});
const source:any={index:0,url:'https://store.example/tiles',title:'Stone tile',price:25,purchaseUnit:'box',quantityPerPack:1.2,coveragePerUnit:null,checkedAt:new Date().toISOString(),note:'1.2 m2 per box'};
test('missing-item comparison is separate from the complete bill and makes unknown quantity explicit',()=>{
 assert.equal(draft.shoppingDraft,true);assert.equal(draft.quantityUnconfirmed,true);assert.equal(draft.items[0].item,'Floor tiles');
 const bill:any={id:'bill',kind:'estimate',data:{...draft,shoppingDraft:false,title:'Complete room',items:[{...draft.items[0],item:'Floor cleaner'}]}};
 assert.deepEqual(materialBills([{id:'draft',kind:'estimate',data:draft} as any,bill]).map(b=>b.id),['bill']);
});
test('selecting a missing product appends it without changing old rows and repeated selection is idempotent',()=>{
 const data={...draft,shoppingDraft:false,items:[{...draft.items[0],item:'Floor cleaner',unit:'piece',manualQuantity:2}],assumptions:[]};
 const next=addShoppingSelection(data,draft,'draft',source);
 assert.equal(data.items.length,1);assert.equal(next.items.length,2);assert.deepEqual(next.items[0],data.items[0]);assert.equal(next.items[1].item,'Floor tiles');assert.equal(next.priceSources[0].index,1);assert.match(next.assumptions[0],/Confirm quantity/);
 const repeat=addShoppingSelection(next,draft,'draft',{...source,price:30});assert.equal(repeat.items.length,2);assert.equal(repeat.priceSources[0].price,30);
 assert.throws(()=>addShoppingSelection({...data,currency:'GBP'},draft,'draft',source),/shopping area/);
 assert.throws(()=>addShoppingSelection({...data,items:Array(40).fill(data.items[0])},draft,'draft',source),/40 items/);
});
test('missing-item search is available for explicit paid shopping and absent for unrelated or free requests',()=>{
 const options={layout:false,materials:false,construction:false,visuals:false,products:true,hasBill:true,paid:true};
 assert.ok(skillTools(options).some(t=>t.name==='search_new_product'));
 assert.ok(!skillTools({...options,products:false}).some(t=>t.name==='search_new_product'));
 assert.ok(!skillTools({...options,paid:false}).some(t=>t.name==='search_new_product'));
});

test('shopping selection checks ownership and project, and retries do not duplicate the appended item',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {SCHEMA,ProjectRepository}=await import('../lib/repository');const {briefSchema}=await import('../lib/domain');const {selectMaterialProduct}=await import('../lib/material-research');const {randomUUID}=await import('node:crypto');
 const db=new PGlite();try{
 await db.exec(SCHEMA);const q={query:(sql:string,args?:any[])=>db.query<Record<string,any>>(sql,args)},owner=randomUUID(),other=randomUUID();
 await q.query("INSERT INTO roomwise.users(id,email,plan) VALUES($1,'shopping-owner@example.test','basic'),($2,'shopping-other@example.test','basic')",[owner,other]);
 const repo=new ProjectRepository(q),room=await repo.create(owner,briefSchema.parse({room:'Bathroom',goal:'Renovate'})),otherRoom=await repo.create(owner,briefSchema.parse({room:'Kitchen',goal:'Renovate'}));
 const billId=randomUUID(),draftId=randomUUID(),bill={...draft,shoppingDraft:false,items:[{...draft.items[0],item:'Floor cleaner'}]},savedDraft={...draft,targetEstimateId:billId,productComparisons:{0:{products:[source]}}};
 await q.query("INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data) VALUES($1,$2,$3,'estimate',$4::jsonb),($5,$2,$3,'estimate',$6::jsonb)",[billId,owner,room.id,JSON.stringify(bill),draftId,JSON.stringify(savedDraft)]);
 await assert.rejects(selectMaterialProduct(q,other,draftId,0,source.url),/Bill not found/);
 await assert.rejects(selectMaterialProduct(q,owner,draftId,0,'https://invented.example/tiles'),/verified product/);
 await q.query('UPDATE roomwise.artifacts SET project_id=$1 WHERE id=$2',[otherRoom.id,billId]);
 await assert.rejects(selectMaterialProduct(q,owner,draftId,0,source.url),/existing room bill/);
 await q.query('UPDATE roomwise.artifacts SET project_id=$1 WHERE id=$2',[room.id,billId]);
 await selectMaterialProduct(q,owner,draftId,0,source.url);await selectMaterialProduct(q,owner,draftId,0,source.url);
 const result=await q.query('SELECT data FROM roomwise.artifacts WHERE id=$1',[billId]);assert.equal(result.rows[0].data.items.length,2);assert.equal(result.rows[0].data.items[0].item,'Floor cleaner');assert.equal(result.rows[0].data.priceSources[0].title,source.title);
 }finally{await db.close();}
});
