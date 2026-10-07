import OpenAI from 'openai';
import assert from 'node:assert/strict';
import { classifyChatIntent } from '../lib/chat-harness';
const cases: {name:string;message:string;expected:Record<string,unknown>;history?:{role:string;content:string}[]}[]=[
 {name:'French renovation',message:'peux tu me montrer une renovation',expected:{visual:'create',materials:false,language:'fr'}},
 {name:'Spanish renovation',message:'Muéstrame una renovación de mi salón',expected:{visual:'create',language:'es'}},
 {name:'German renovation',message:'Zeig mir ein renoviertes Wohnzimmer',expected:{visual:'create',language:'de'}},
 {name:'Japanese concept',message:'この部屋をリノベーションした画像を見せてください',expected:{visual:'create',language:'ja'}},
 {name:'Arabic concept',message:'أرني صورة لهذه الغرفة بعد تجديدها',expected:{visual:'create',language:'ar'}},
 {name:'Portuguese materials',message:'Preciso de uma lista de materiais e quantidades para executar esta reforma, sem criar imagens',expected:{visual:'none',materials:true,products:false,language:'pt'}},
 {name:'French mixed implementation',message:'Prépare la nomenclature de toutes les fournitures et le mode opératoire, pas de nouveau visuel',expected:{visual:'none',materials:true,construction:true,products:false}},
 {name:'German work plan',message:'Erstelle eine Materialliste und eine Schritt-für-Schritt-Arbeitsanleitung, kein neues Bild',expected:{visual:'none',materials:true,construction:true}},
 {name:'Incremental French edit',message:'C’est trop sombre, garde le canapé et les carreaux mais éclaircis seulement les murs',expected:{visual:'revise',restart:false,language:'fr'}},
 {name:'Explicit restart',message:'Start over from my original photo with a completely different style',expected:{visual:'create',restart:true}},
 {name:'Subscription advice',message:'Quel abonnement me conseilles-tu pour refaire seulement ma cuisine ?',expected:{planAdvice:true,construction:false,visual:'none'}},
 {name:'Complaint without paid edit',message:'I am not satisfied with Archicova, the results are wrong and this keeps happening',expected:{complaint:true,visual:'none'}},
 {name:'Short offer consent',message:'Oui merci',history:[{role:'assistant',content:'Voulez-vous que je génère un visuel de cette rénovation ?'}],expected:{visual:'create'}},
 {name:'Image refusal',message:'Do not generate another image. Just give me the bill of materials for this design.',expected:{visual:'none',materials:true,products:false}},
 {name:'Gratitude',message:'Merci beaucoup',expected:{visual:'none',materials:false,construction:false,products:false}},
];
async function main(){
 if(process.env.ARCHICOVA_HARNESS_EVAL!=='1'){console.log('Harness semantic evaluation: opt-in disabled');return;}
 assert.equal(process.env.VERCEL_ENV,'preview','Semantic evaluations must use preview');
 assert.ok(process.env.OPENAI_API_KEY,'Evaluation needs configured model access');
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:20000});
 const ready=[{id:'11111111-1111-4111-8111-111111111111',hasImage:true,data:{sourcePhotoId:'22222222-2222-4222-8222-222222222222',title:'Renovated living room'}}];
 for(const entry of cases){
  console.log(`Harness semantic evaluation running: ${entry.name}`);
  const revision=entry.name==='Incremental French edit'||entry.name==='Explicit restart';
  const result=await classifyChatIntent(client,process.env.OPENAI_MODEL!,entry.message,entry.history||[],revision?ready:[]);
  assert.equal(result.semantic,true,`${entry.name}: provider routing unavailable`);
  for(const [key,value] of Object.entries(entry.expected))assert.equal(result.intent[key as keyof typeof result.intent],value,`${entry.name}: ${key}`);
  console.log(`Harness semantic evaluation passed: ${entry.name}`);
 }
 console.log(`Harness semantic evaluation: ${cases.length} passed`);
}
main().catch(()=>{console.error('Harness semantic evaluation failed; inspect the last named case. No provider error or user data is logged.');process.exitCode=1;});
