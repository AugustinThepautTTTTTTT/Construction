import test from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { productSearchRequest, runProductSearch, reusableProductResearch, PRICE_RESEARCH_VERSION } from "../lib/product-search";
import { estimateSchema } from "../lib/room-artifacts";
const estimate=estimateSchema.parse({title:"Bathroom",country:"FR",city:"Mulhouse",currency:"EUR",items:[{item:"Wall paint",specification:"Bathroom washable warm white",basis:"manual",manualQuantity:1,unit:"litre",coveragePerUnit:null,coats:1,waste:0,priceLow:15,priceHigh:35}],assumptions:[],exclusions:[]});
test("product searches target the material and local retailers on Luna with bounded calls",()=>{
  const request=productSearchRequest(estimate,0,"gpt-6-luna");
  assert.equal(request.model,"gpt-6-luna");assert.equal(request.max_tool_calls,2);
  assert.match(request.input as string,/Mulhouse/);assert.match(request.instructions!,/actual pack price/);
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
test("empty, old-version, partial and stale bills can search again",()=>{
  const data={items:[{}],priceSources:[{}],pricesCheckedAt:new Date().toISOString(),priceResearchVersion:PRICE_RESEARCH_VERSION};
  assert.equal(reusableProductResearch(data),true);
  assert.equal(reusableProductResearch({...data,priceSources:[]}),false);
  assert.equal(reusableProductResearch({...data,priceResearchVersion:1}),false);
  assert.equal(reusableProductResearch({...data,items:[{},{}]}),false);
  assert.equal(reusableProductResearch({...data,pricesCheckedAt:"2020-01-01"}),false);
});
