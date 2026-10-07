import test from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { productSearchRequest, runProductSearch, reusableComparison } from "../lib/product-search";
import {vettedPrices} from "../lib/price-research";
import { estimateSchema } from "../lib/room-artifacts";
const estimate=estimateSchema.parse({title:"Bathroom",country:"FR",city:"Mulhouse",currency:"EUR",items:[{item:"Wall paint",specification:"Bathroom washable warm white",basis:"manual",manualQuantity:1,unit:"litre",coveragePerUnit:null,coats:1,waste:0,priceLow:15,priceHigh:35}],assumptions:[],exclusions:[]});
test("product searches target the material and local retailers on Luna with bounded calls",()=>{
  const request=productSearchRequest(estimate,0,"gpt-6-luna");
  assert.equal(request.model,"gpt-6-luna");assert.equal(request.max_tool_calls,3);
  assert.match(request.input as string,/Mulhouse/);assert.match(request.instructions!,/actual pack price/);assert.equal((request.tools![0] as any).filters,undefined);assert.match(request.instructions!,/different suitable retailers/);
  assert.equal(request.tool_choice,"required");
});
test("rejected search schemas retry once with preview; paid or transient failures do not retry",async()=>{
  const calls:any[]=[];const request=productSearchRequest(estimate,0,"gpt-6-luna");
  const client={responses:{create:async(input:any)=>{calls.push(input);if(calls.length===1)throw{status:400,param:"tools"};return{status:"completed",output_text:"Product",output:[]};}}} as unknown as Pick<OpenAI,"responses">;
  await runProductSearch(client,request);
  assert.equal(calls.length,2);assert.equal(calls[1].tools[0].type,"web_search_preview");assert.equal(calls[1].model,"gpt-6-luna");assert.deepEqual(calls[1].include,[]);
  for(const failure of [{status:429,param:"tools"},{status:400,param:"input"}]){
    let count=0;const failing={responses:{create:async()=>{count++;throw failure;}}} as unknown as Pick<OpenAI,"responses">;
    await assert.rejects(runProductSearch(failing,request));assert.equal(count,1);
  }
});
test("only a fresh successful comparison of the same requested item and preferences is reused",()=>{
 const data={index:0,preferences:"blue",products:[{}],checkedAt:new Date().toISOString()};
 assert.equal(reusableComparison(data,0,"blue"),true);
 assert.equal(reusableComparison({...data,products:[]},0,"blue"),false);
 assert.equal(reusableComparison(data,1,"blue"),false);
 assert.equal(reusableComparison(data,0,"white"),false);
 assert.equal(reusableComparison({...data,checkedAt:"2020-01-01"},0,"blue"),false);
});

test("default bills never trigger automatic product sourcing; requests target one item",()=>{
  assert.throws(()=>productSearchRequest(estimate,[0] as any,"gpt-6-luna"),/one material/);
  const request=productSearchRequest(estimate,0,"gpt-6-luna","under 40 EUR");assert.match(request.input as string,/under 40 EUR/);
});

test("open-market comparisons retain multiple evidenced retailers, rejecting invented links and prices",()=>{
 const first="https://www.tollens.com/products/blue",second="https://www.specialist-shop.fr/products/paint";
 const product={index:0,price:20,url:first,title:"Blue paint",currency:"EUR",unit:"litre",note:"Washable finish",sourceEvidence:"20 EUR",coveragePerUnit:null,coverageEvidence:null};
 const options={openRetailers:true,allowAlternatives:true};
 const matches=vettedPrices({products:[product,{...product,url:second,title:"Alternative paint"}]},estimate,new Set([first,second]),"Price 20 EUR",undefined,options);assert.equal(matches.length,2);
 assert.equal(vettedPrices({products:[{...product,url:"https://fake.test/product"}]},estimate,new Set([first]),"20 EUR",undefined,options).length,0);
 assert.equal(vettedPrices({products:[{...product,price:99}]},estimate,new Set([first]),"20 EUR",undefined,options).length,0);
});
