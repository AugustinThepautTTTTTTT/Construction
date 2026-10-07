import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {SCHEMA,ProjectRepository} from "../lib/repository";
import {briefSchema} from "../lib/domain";
import {bindVisualPhoto,imageChargeCents,reconcileImageBudget} from "../lib/visual-recovery";
test("a single verified context photo overrides a model-invented reference; multiple views require an exact selection",()=>{
 const photo=randomUUID();assert.deepEqual(bindVisualPhoto({sourcePhotoId:"invented",brief:"Blue room"},[photo]),{sourcePhotoId:photo,brief:"Blue room"});
 assert.throws(()=>bindVisualPhoto({sourcePhotoId:randomUUID()},[photo,randomUUID()]),/available original/);
 assert.throws(()=>bindVisualPhoto({},[]),/Upload/);
});
test("successful image usage is conservatively costed; unknown usage never frees budget",()=>{
 assert.equal(imageChargeCents({input_tokens:1000,output_tokens:2000}),8);
 assert.equal(imageChargeCents({input_tokens:-1,output_tokens:2000}),null);
 assert.equal(imageChargeCents({input_tokens:1000}),null);
});
test("confirmed image reservation surplus is released atomically once, without changing the cap",async()=>{
 const db=new PGlite();await db.exec(SCHEMA);const owner=randomUUID(),other=randomUUID(),id=randomUUID();await db.query("INSERT INTO roomwise.users(id,email) VALUES($1,'recovery@test.com')",[owner]);const repo=new ProjectRepository(db as any),room=await repo.create(owner,briefSchema.parse({room:"Bathroom",goal:"Blue finishes"}));
 await db.query("INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data,image,model) VALUES($1,$2,$3,'visual',$4::jsonb,$5,'gpt-image-2.5-sunburst')",[id,owner,room.id,JSON.stringify({usage:{input_tokens:1000,output_tokens:2000}}),Buffer.from('confirmed image')]);await db.query("INSERT INTO roomwise.ai_budget VALUES('poc',1000,955)");
 assert.equal(await reconcileImageBudget(db as any,other,id),0);
 const refunds=await Promise.all([reconcileImageBudget(db as any,owner,id),reconcileImageBudget(db as any,owner,id)]);assert.equal(refunds.reduce((a,b)=>a+b,0),42);
 const budget=(await db.query<any>("SELECT * FROM roomwise.ai_budget WHERE id='poc'")).rows[0];assert.equal(budget.reserved_cents,913);assert.equal(budget.limit_cents,1000);
 await db.close();
});
