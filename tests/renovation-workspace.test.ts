import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {SCHEMA} from "../lib/repository";
import {loadWorkspace,changeWorkspace,purchaseKey,shoppingReadiness} from "../lib/renovation-workspace";

test("renovation state persists separately per owner with version checks and undo",async()=>{
 const db=new PGlite();await db.exec(SCHEMA);
 const owner=randomUUID(),other=randomUUID(),project=randomUUID();
 await db.query("INSERT INTO roomwise.users(id,email) VALUES($1,$2),($3,$4)",[owner,"renovator@test.com",other,"other-renovator@test.com"]);
 await db.query("INSERT INTO roomwise.projects(id,user_id,title,brief) VALUES($1,$2,'Bathroom','{}'::jsonb)",[project,owner]);
 const initial=await loadWorkspace(db as any,owner,project);assert.equal(initial.revision,0);assert.deepEqual(initial.state.decisions,[]);
 const added=await changeWorkspace(db as any,owner,project,{action:"decision",value:{id:randomUUID(),label:"Keep original tiles",details:"Reduce demolition",status:"confirmed",element:"Walls",updatedAt:new Date().toISOString()}},0);
 assert.equal(added.revision,1);assert.equal(added.state.decisions[0].status,"confirmed");assert.ok(added.state.review.shopping);assert.ok(added.state.review.construction);
 const measure=await changeWorkspace(db as any,owner,project,{action:"measurement",value:{id:randomUUID(),label:"Shower opening",zone:"Shower",value:82,unit:"cm",confidence:"measured",notes:"At floor",photoId:null}},1);
 assert.equal(measure.revision,2);assert.equal(measure.state.measurements.length,1);assert.match(measure.state.review.shopping||"",/measurements changed/i);
 await assert.rejects(()=>changeWorkspace(db as any,owner,project,{action:"usability",value:false},1),/changed/);
 await assert.rejects(()=>changeWorkspace(db as any,other,project,{action:"usability",value:false},0),/not found/);
 assert.equal((await loadWorkspace(db as any,other,project)).revision,0);
 const undo=await changeWorkspace(db as any,owner,project,{action:"undo"},2);
 assert.equal(undo.revision,3);assert.equal(undo.state.measurements.length,0);assert.equal(undo.state.decisions.length,1);
 const persisted=await loadWorkspace(db as any,owner,project);assert.equal(persisted.revision,3);
 await db.close();
});
test("shopping keys and readiness never invent verified measurements",()=>{
 assert.equal(purchaseKey("estimate-id",4),"estimate-id:4");
 assert.equal(shoppingReadiness(undefined,false),"needs_measurements");
 assert.equal(shoppingReadiness(undefined,true),"ready");
 assert.equal(shoppingReadiness("purchased",false),"purchased");
});
