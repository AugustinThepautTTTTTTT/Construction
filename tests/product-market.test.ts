import test from 'node:test';
import assert from 'node:assert/strict';
import {productSearchRequest,reusableComparison,resolveSearchLocation,diverseProductOptions} from '../lib/product-search';
import {estimateSchema} from '../lib/room-artifacts';
const estimate=estimateSchema.parse({title:'Room',country:'FR',city:'Mulhouse',currency:'EUR',items:[{item:'Paint',specification:'Washable warm white',basis:'manual',manualQuantity:1,unit:'litre',coveragePerUnit:null,coats:1,waste:0,priceLow:15,priceHigh:35}],assumptions:[],exclusions:[]});
test('a user-selected city and postcode govern the search and the fallback tool',()=>{
 const location=resolveSearchLocation(estimate,{city:'  Strasbourg ',postalCode:' 67000 '});
 assert.deepEqual(location,{country:'FR',city:'Strasbourg',postalCode:'67000'});
 const request=productSearchRequest(estimate,0,'model','white',location);
 assert.equal((request.tools![0] as any).user_location.city,'Strasbourg');assert.match(request.input as string,/67000/);assert.match(request.instructions!,/six/);assert.match(request.instructions!,/Never claim/);
});
test('comparisons cannot be reused across cities or postcodes, and legacy locationless caches are refreshed',()=>{
 const location=resolveSearchLocation(estimate),cached={index:0,preferences:'',products:[{}],checkedAt:new Date().toISOString(),location};
 assert.equal(reusableComparison(cached,0,'',location),true);
 assert.equal(reusableComparison(cached,0,'',{...location,city:'Paris'}),false);
 assert.equal(reusableComparison(cached,0,'',{...location,postalCode:'68100'}),false);
 assert.equal(reusableComparison({...cached,location:undefined},0,'',location),false);
});
test('carousel candidates prioritize distinct stores, cap six and keep at most two per store',()=>{
 const options=Array.from({length:12},(_,index)=>({url:`https://shop${index%4}.example/products/${index}`,index:0,title:String(index)}));
 const result=diverseProductOptions(options as any);
 assert.equal(result.length,6);assert.equal(new Set(result.slice(0,4).map(p=>new URL(p.url).hostname)).size,4);
 for(const p of result)assert.ok(result.filter(q=>new URL(q.url).hostname===new URL(p.url).hostname).length<=2);
});

test('the carousel renders a verified store, explicit project cost and keyboard controls without auto-starting paid search',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {ProductComparisonView}=await import('../components/product-comparison');
 const source={index:0,url:'https://store.example/product/paint',title:'Washable paint',price:20,note:'Check delivery',purchaseUnit:'litre',quantityPerPack:1};
 const artifact:any={id:'bill',data:{...estimate,productComparisons:{0:{products:[source,{...source,url:'https://second.example/product/paint',title:'Alternative paint'}],notice:'Check stock',checkedAt:new Date().toISOString()}}}};
 const html=renderToStaticMarkup(React.createElement(ProductComparisonView,{artifact,index:0,onChanged:()=>{}}));
 assert.match(html,/aria-roledescription="carousel"/);assert.match(html,/Previous product/);assert.match(html,/Next product/);assert.match(html,/Find nearby products|Refresh product search/);assert.match(html,/City/);assert.match(html,/Postcode/);assert.match(html,/4 credits/);assert.match(html,/For your project/);assert.match(html,/Add to BOM/);assert.match(html,/aria-hidden="true"/);
});
test('location inputs validate before a charged search',async()=>{
 const {productSearchLocationSchema}=await import('../lib/material-research');
 assert.equal(productSearchLocationSchema.safeParse({city:' ',postalCode:'123'}).success,false);
 assert.equal(productSearchLocationSchema.safeParse({city:'Paris',country:'US'}).success,false);
 assert.equal(productSearchLocationSchema.safeParse({city:'Paris',postalCode:'x'.repeat(21)}).success,false);
});

test('chat product searches accept explicit areas and publish a strict nullable location tool',async()=>{
 const {productLookupSchema}=await import('../lib/material-research');
 const {skillTools}=await import('../lib/skill-registry');
 const args={estimateId:'00000000-0000-4000-8000-000000000001',index:0,preferences:''};
 assert.equal(productLookupSchema.safeParse(args).success,true);
 assert.equal(productLookupSchema.parse({...args,location:{city:'Paris',postalCode:'75001'}}).location?.city,'Paris');
 const tool=skillTools().find(tool=>tool.name==='search_material_product')!;
 assert.ok(tool.parameters.required!.includes('location'));
 const location=(tool.parameters.properties as any).location;
 assert.ok(location.anyOf.some((variant:any)=>variant.type==='null'));
 assert.deepEqual(location.anyOf.find((variant:any)=>variant.type==='object').required,['city','postalCode']);
});
