import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyChatIntent} from '../lib/chat-harness';
const flags={visual:'none',materials:true,construction:false,products:false,layout:false,complaint:false,planAdvice:false,restart:false,clarify:false,language:'fr'};
test('location routing retains a stated French market instead of treating it as UK',async()=>{
 let input:any;
 const result=await classifyChatIntent({responses:{create:async(request:any)=>{input=JSON.parse(request.input);return {output_text:JSON.stringify({...flags,market:{city:'Mulhouse',country:'FR',currency:'EUR'}})};}}} as any,'model','Fais la liste des matériaux',[{role:'user',content:'Je rénove à Mulhouse'},...Array.from({length:8},()=>({role:'assistant',content:'Design details'}))],[]);
 assert.equal((result.intent as any).market?.country,'FR');
 assert.ok(input.locationHistory.some((m:any)=>m.content.includes('Mulhouse')));
});
test('foreign bill prices cannot be relabelled as the user market',async()=>{
 const {assertMarketMatches}=await import('../lib/market-context');
 assert.throws(()=>assertMarketMatches({city:'London',country:'GB',currency:'GBP'},{city:'Mulhouse',country:'FR',currency:'EUR'}),/regenerate/i);
 assert.throws(()=>assertMarketMatches({city:'Mulhouse',country:'GB',currency:'GBP'},null),/city and country/i);
 assert.doesNotThrow(()=>assertMarketMatches({city:'Mulhouse',country:'FR',currency:'EUR'},{city:'mulhouse',country:'FR',currency:'EUR'}));
});
