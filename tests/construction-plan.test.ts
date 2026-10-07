import test from "node:test";
import assert from "node:assert/strict";
import { constructionSchema,validateConstruction,linkConstruction } from "../lib/construction-plan";
import type {Artifact} from "../lib/room-artifacts";
const id="00000000-0000-4000-8000-000000000001";
const bill:Artifact={id,kind:"estimate",status:"ready",created_at:new Date().toISOString(),data:{title:"Bathroom materials",currency:"EUR",items:[{item:"Roller"}],calculations:{items:[{index:0,item:"Roller",quantity:1,unit:"piece",priceLow:8,priceHigh:12,low:8,high:12}]},priceSources:[{index:0,title:"Microfibre roller",price:9,url:"https://www.leroymerlin.fr/produits/roller.html"}]}};
const plan=constructionSchema.parse({title:"Paint the bathroom",estimateId:id,overview:"Retain existing tiles.",steps:[{title:"Apply paint",instructions:["Cut in, then roll the sound prepared walls."],materialIndexes:[0],dependsOn:[],duration:"1 hour",dryingTime:"Follow selected paint label",checks:["Even finish"],professionalRequired:false}],assumptions:["Sound substrate"]});
test("works plans resolve the current bill products rather than copying shopping data",()=>{
  const linked=linkConstruction(plan,bill);assert.equal(linked.steps[0].materials[0].source.price,9);
  bill.data.priceSources[0].price=10;assert.equal(linkConstruction(plan,bill).steps[0].materials[0].source.price,10);
});
test("works plans reject missing rows, a different bill and forward dependencies",()=>{
  assert.throws(()=>validateConstruction({...plan,steps:[{...plan.steps[0],materialIndexes:[1]}]},bill),/missing material/);
  assert.throws(()=>validateConstruction({...plan,estimateId:"00000000-0000-4000-8000-000000000002"},bill),/saved bill/);
  assert.throws(()=>validateConstruction({...plan,steps:[{...plan.steps[0],dependsOn:[0]}]},bill),/earlier/);
});
