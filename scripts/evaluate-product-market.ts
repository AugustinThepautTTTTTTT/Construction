import {skillTools,skillInstructions} from '../lib/skill-registry';
import {newProductSchema} from '../lib/product-shopping';
import OpenAI from 'openai';
import assert from 'node:assert/strict';
import {estimateSchema} from '../lib/room-artifacts';
import {productSearchRequest,runProductSearch,productExtractionRequest,resolveSearchLocation,diverseProductOptions} from '../lib/product-search';
import {productThumbnail} from '../lib/product-thumbnails';
import {retrievedUrls,vettedPrices} from '../lib/price-research';
async function main(){
 if(process.env.ARCHICOVA_MARKET_EVAL==='shopping'){
  assert.equal(process.env.VERCEL_ENV,'preview');assert.ok(process.env.OPENAI_API_KEY);assert.ok(process.env.OPENAI_MODEL);
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:60000});
  const billId='11111111-1111-4111-8111-111111111111';
  const response=await client.responses.create({model:process.env.OPENAI_MODEL,reasoning:{effort:'none'},store:false,max_output_tokens:1500,tool_choice:'required',parallel_tool_calls:false,tools:skillTools({layout:false,visuals:false,materials:false,construction:false,inspiration:false,executionUpdate:false,products:true,hasBill:true,paid:true}),instructions:skillInstructions()+' The user explicitly requests a shopping comparison. Their complete bill does not include floor tiles; floor cleaner is a different product. Search the actual requested missing item without modifying the bill. User-established market: Mulhouse, FR, EUR. The user has not confirmed a measured floor quantity.',input:JSON.stringify({message:'Can we find such floor tile products? I would like to compare prices for matte warm-stone bathroom tiles.',bill:{id:billId,items:[{index:0,item:'Bathroom floor cleaner',specification:'Cleaning existing tiles',unit:'bottle'}]}})});
  const call=response.output.find(item=>item.type==='function_call');assert.ok(call&&call.type==='function_call');assert.equal(call.name,'search_new_product');
  const args=newProductSchema.parse(JSON.parse(call.arguments));assert.equal(args.estimateId,billId);assert.equal(args.quantity,null);assert.match(args.item,/tile|carrelage/i);assert.doesNotMatch(args.item,/cleaner|nettoy/i);
  console.log('Missing-item shopping evaluation passed: floor tiles searched separately from cleaner; quantity remains provisional. No search, customer writes or credits used.');return;
 }
 if(process.env.ARCHICOVA_MARKET_EVAL!=='1'){console.log('Product market evaluation: opt-in disabled');return;}
 assert.equal(process.env.VERCEL_ENV,'preview');assert.ok(process.env.OPENAI_API_KEY);assert.ok(process.env.OPENAI_MODEL);
 const estimate=estimateSchema.parse({title:'Synthetic market check',country:'FR',city:'Mulhouse',currency:'EUR',items:[{item:'Dining chair',specification:'Wooden dining chair for a living room, sold individually',basis:'manual',manualQuantity:3,unit:'piece',coveragePerUnit:null,coats:1,waste:0,priceLow:50,priceHigh:200}],assumptions:[],exclusions:[]});
 const location=resolveSearchLocation(estimate,{city:'Mulhouse',postalCode:'68100'}),client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:90000});
 console.log('Product market evaluation running: one synthetic item in Mulhouse, FR');
 const preferences='Compare individually sold chairs across IKEA, Maisons du Monde, La Redoute or other French furniture retailers. Avoid bundles.';
 const search=await runProductSearch(client,productSearchRequest(estimate,0,process.env.OPENAI_MODEL!,preferences,location));assert.equal(search.status,'completed');
 const urls=retrievedUrls(search.output),extraction=await client.responses.create(productExtractionRequest(estimate,0,process.env.OPENAI_MODEL!,preferences,location,search.output_text,urls));assert.equal(extraction.status,'completed');
 const extracted=JSON.parse(extraction.output_text),diagnostics:Record<string,number>={};
 const products=diverseProductOptions(vettedPrices(extracted,estimate,urls,search.output_text,diagnostics,{openRetailers:true,allowAlternatives:true}));
 console.log(`Product evidence evaluation: ${urls.size} retrieved URLs, ${extracted.products.length} extracted products; rejected ${JSON.stringify(diagnostics)}`);
 const stores=new Set(products.map(p=>new URL(p.url).hostname.replace(/^www\./,'')));
 console.log(`Product market evaluation: ${products.length} verified products from ${stores.size} stores`);
 const photos=await Promise.all(products.map(product=>productThumbnail(product)));
 console.log(`Product preview evaluation: ${photos.filter(Boolean).length} accessible product photos; ${products.filter(product=>product.imageUrl).length} image URLs supplied by research`);
 assert.ok(photos.some(Boolean),'At least one actual product photograph must load through the app preview pipeline');
 assert.ok(products.length>=2&&stores.size>=2,'Evaluation needs evidenced options from different stores');assert.ok(products.length<=6);
 console.log('Product market evaluation passed; no customer account, bill or credits modified');
}
main().catch(()=>{console.error('Product market evaluation failed. No raw provider response or credentials logged.');process.exitCode=1;});
