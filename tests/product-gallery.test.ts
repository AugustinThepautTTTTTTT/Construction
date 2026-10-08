import test from 'node:test';
import assert from 'node:assert/strict';
import {productImage} from '../lib/product-images';
test('product photography takes precedence over a generic social preview and nested image objects are supported',()=>{
 const html='<meta property="og:image" content="https://cdn.store.com/logo.png"><script type="application/ld+json">{"mainEntity":{"@type":"Product","image":{"@type":"ImageObject","contentUrl":"https://cdn.store.com/towels.webp"}}}</script>';
 assert.equal(productImage(html,'https://store.com/towels'),'https://cdn.store.com/towels.webp');
});
test('product metadata handles HTML entities and unquoted attributes',()=>{
 assert.equal(productImage('<meta property=og:image content="https://cdn.store.com/a.jpg?x=1&#38;y=2">','https://store.com/towels'),'https://cdn.store.com/a.jpg?x=1&y=2');
});
test('three retailer alternatives remain visible and interactive, with private app preview URLs',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{ProductComparisonView}=await import('../components/product-comparison');
 const billId='00000000-0000-4000-8000-000000000001';
 const source={index:0,title:'Beige towels',price:18,purchaseUnit:'set',quantityPerPack:1,note:'Check delivery',imageUrl:'https://cdn.store.com/towels.webp'};
 const artifact:any={id:billId,data:{country:'FR',city:'Mulhouse',currency:'EUR',items:[{item:'Towels',specification:'Beige cotton',basis:'manual',manualQuantity:1,unit:'set',coats:1,waste:0,coveragePerUnit:null,priceLow:10,priceHigh:30}],productComparisons:{0:{products:[1,2,3].map(n=>({...source,url:`https://store${n}.com/towels`})),checkedAt:new Date().toISOString()}}}};
 const html=renderToStaticMarkup(React.createElement(ProductComparisonView,{artifact,index:0,onChanged:()=>{},onRequest:()=>{}}));
 assert.equal((html.match(/aria-roledescription="slide"/g)||[]).length,3);
 assert.equal((html.match(/\/product-image\?index=0/g)||[]).length,3);
 assert.doesNotMatch(html,/marketCardShell side|marketSideSelect|inert=""/);assert.doesNotMatch(html,/<form/);
});
test('photo links are preserved only when they occur in the researched listing evidence',async()=>{
 const {vettedPrices}=await import('../lib/price-research'),{estimateSchema}=await import('../lib/room-artifacts');
 const estimate=estimateSchema.parse({title:'Room',country:'FR',city:'Mulhouse',currency:'EUR',items:[{item:'Paint',specification:'White',basis:'manual',manualQuantity:1,unit:'litre',coveragePerUnit:null,coats:1,waste:0,priceLow:10,priceHigh:30}],assumptions:[],exclusions:[]});
 const product={index:0,price:20,url:'https://store.com/paint',title:'White paint',currency:'EUR',unit:'litre',note:'Check stock',sourceEvidence:'20 EUR',coveragePerUnit:null,coverageEvidence:null,imageUrl:'https://cdn.store.com/paint.jpg'};
 const check=(findings:string)=>vettedPrices({products:[product]},estimate,new Set([product.url]),findings,undefined,{openRetailers:true,allowAlternatives:true})[0];
 assert.equal(check('20 EUR')?.imageUrl,undefined);assert.equal(check(`20 EUR ${product.imageUrl}`)?.imageUrl,product.imageUrl);
});
