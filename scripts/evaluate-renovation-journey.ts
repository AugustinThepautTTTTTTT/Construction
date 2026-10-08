import OpenAI from 'openai';
import assert from 'node:assert/strict';
import {aiPolicy} from '../lib/ai-budget';
import {classifyChatIntent} from '../lib/chat-harness';
import {skillTools,skillInstructions} from '../lib/skill-registry';
import {workContext,workUpdateSchema} from '../lib/work-assistant';
async function main(){
if(process.env.ARCHICOVA_JOURNEY_EVAL!=='1')console.log('Renovation journey evaluation: opt-in disabled');
else{
 assert.equal(process.env.VERCEL_ENV,'preview','Live evaluation is preview-only');
 const policy=aiPolicy();assert.ok(policy);
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:60000,maxRetries:0});
 const cases=[
  {message:'I want to refresh my bathroom on a small budget. I am not sure about the style.',room:'Bathroom'},
  {message:'Je veux refaire ma cuisine, mais je cherche encore un style.',room:'Kitchen'},
  {message:'Ich möchte mein Wohnzimmer renovieren und suche Inspiration.',room:'Living room'},
  {message:'Quiero renovar mi dormitorio y necesito ideas de estilo.',room:'Bedroom'},
  {message:'I finished step 1. How do I do step 2?',update:true},
  {message:'J’ai terminé l’étape 1. Comment faire l’étape 2 ?',update:true},
  {message:'How do I do step 2 if I finish step 1 tomorrow?',update:false},
  {message:'Comment réaliser l’étape 2 ? Ne coche rien, je pose seulement une question.',update:false},
 ];
 for(const item of cases){
  const result=await classifyChatIntent(client,policy.model,item.message,[],[],false,{hasWorkPlan:'update' in item,hasInspiration:'update' in item});assert.equal(result.semantic,true);
  if('room' in item)assert.equal(result.intent.inspiration,item.room);
  else{assert.equal(result.intent.execution,true);assert.equal(result.intent.executionUpdate,item.update);assert.equal(result.intent.inspiration,'none');}
 }
 const language=await classifyChatIntent(client,policy.model,'How do I carry out step 2?', [{role:'user',content:'Je souhaite refaire cette pièce.'},{role:'assistant',content:'Voici votre plan de travaux.'},{role:'user',content:'Explain step 1',uiAction:true}],[],false,{hasWorkPlan:true,hasInspiration:true,uiAction:true});assert.equal(language.semantic,true);assert.equal(language.intent.language,'fr');
 const id='00000000-0000-4000-8000-000000000001';
 const data={title:'Wall repaint',estimateId:'00000000-0000-4000-8000-000000000002',workRevision:4,completedSteps:{},overview:'Prepare then paint.',assumptions:['Sound dry walls'],steps:[{title:'Prepare the walls',instructions:['Protect flooring and clean the wall'],checks:['Dry and sound'],dependsOn:[],materialIndexes:[0],duration:'1 hour',dryingTime:'Wait until dry',professionalRequired:false},{title:'Apply paint',instructions:['Apply according to the selected product label'],checks:['Even coverage'],dependsOn:[0],materialIndexes:[1],duration:'2 hours',dryingTime:'Follow product label',professionalRequired:false}]};
 const response=await client.responses.create({model:policy.model,instructions:skillInstructions()+'\nUse only the saved plan; user reports step 1 finished. Save that completion and leave all instructions/checks unchanged. Do not create another plan.',input:JSON.stringify({message:'J’ai fini l’étape 1, comment faire l’étape 2 ?',plan:{id,...workContext(data,'étape 2')}}),tools:skillTools({layout:false,products:false,materials:false,construction:false,visuals:false,paid:true,executionUpdate:true}),tool_choice:{type:'function',name:'update_work_plan'},parallel_tool_calls:false,max_output_tokens:2000,reasoning:{effort:'none'},store:false});
 assert.equal(response.status,'completed');const call=response.output.find(item=>item.type==='function_call');assert.ok(call&&call.type==='function_call');const update=workUpdateSchema.parse(JSON.parse(call.arguments));assert.equal(update.planId,id);assert.equal(update.expectedRevision,4);assert.equal(update.index,0);assert.equal(update.checked,true);assert.equal(update.instructions,null);assert.equal(update.checks,null);
 console.log('Renovation journey evaluation passed: 9 multilingual routing cases and 1 real strict work-plan tool call; no customer records or credits changed.');
}

}
main().catch(error=>{console.error("Renovation journey evaluation failed:",error.message);process.exitCode=1;});
