import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProductComparisonView} from '../components/product-comparison';
test('chat product results offer conversational follow-ups instead of a separate search form',()=>{
 const artifact:any={id:'bill',data:{country:'FR',city:'Mulhouse',currency:'EUR',items:[{item:'Wall paint'}]}};
 const html=renderToStaticMarkup(React.createElement(ProductComparisonView,{artifact,index:0,cardsOnly:true,onChanged:()=>{},onRequest:()=>{}} as any));
 assert.doesNotMatch(html,/<form/);assert.match(html,/Refine in chat/);assert.doesNotMatch(html,/Change area or refine search/);
});
test('product buttons carry the exact bill row separately from readable chat text',async()=>{
 const {productChatRequest}=await import('../lib/product-chat');
 const request=productChatRequest('00000000-0000-4000-8000-000000000001',3,'Terracotta tiles');
 assert.deepEqual(request.productTarget,{estimateId:'00000000-0000-4000-8000-000000000001',index:3});
 assert.match(request.message,/Terracotta tiles/);assert.doesNotMatch(request.message,/00000000|index|estimateId/);
});
