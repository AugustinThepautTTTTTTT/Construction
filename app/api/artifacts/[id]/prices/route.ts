import OpenAI from "openai";
import {classifyChatIntent} from "@/lib/chat-harness";
import {aiPolicy} from "@/lib/ai-budget";
import {assertMarketMatches} from "@/lib/market-context";
import {CreditError,requirePaid} from "@/lib/credits";
import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { identity,sameOrigin,error } from "@/lib/server";
import { database } from "@/lib/database";
import { searchMaterialProduct,selectMaterialProduct,ProductSearchError,productSearchLocationSchema } from "@/lib/material-research";
export const maxDuration=180;
const lookup=z.object({index:z.number().int().min(0).max(39),preferences:z.string().max(500).default(""),location:productSearchLocationSchema.optional()}).strict();
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(r))return error("Invalid request origin.",403);
 try{
  const user=await identity(r),db=await database(),{id}=await params;
  if(!user?.email||!db)return error("Sign in to compare products.",401);
  if(!z.string().uuid().safeParse(id).success)return error("Bill not found.",404);
  const body=lookup.safeParse(await r.json().catch(()=>null));if(!body.success)return error("Select one material item to research.",400);
  const result=await db.query("SELECT a.data,a.project_id,p.paid,p.brief,p.messages FROM roomwise.artifacts a JOIN roomwise.projects p ON p.id=a.project_id WHERE a.id=$1 AND a.user_id=$2 AND a.kind='estimate'",[id,user.id]);
  if(!result.rows.length)return error("Bill not found.",404);

  await requirePaid(db,user.id);
  const project=result.rows[0];
  let market=project.brief?.market;
  if(!market || (body.data.location && body.data.location.city.toLocaleLowerCase()!==market.city.toLocaleLowerCase())){
    const policy=aiPolicy();if(!policy)return error("Product search is temporarily unavailable.",503);
    const resolved=await classifyChatIntent(new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:15000,maxRetries:0}),policy.model,body.data.location && body.data.location.city.toLocaleLowerCase()!==project.data.city.toLocaleLowerCase()?`Find products in ${body.data.location.city}. Resolve this shopping city's country; do not assume the old bill's country.`:'Find products in my stated renovation city.',[{role:'user',content:`User project brief: ${JSON.stringify(project.brief)}`},...(project.messages||[])],[]);
    if(!resolved.semantic||!resolved.intent.market?.country||!resolved.intent.market.currency)return error("Please confirm your shopping city and country in chat before searching.",409);
    market=resolved.intent.market;
    await db.query("UPDATE roomwise.projects SET brief=brief || $1::jsonb WHERE id=$2 AND user_id=$3",[JSON.stringify({market,location:`${market.city}, ${market.country}`}),project.project_id,user.id]);
  }
  try{assertMarketMatches(project.data,market);}catch(e){return error((e as Error).message,409);}
  const comparison=await searchMaterialProduct(db,user.id,id,result.rows[0].data,body.data.index,body.data.preferences,body.data.location);
  return NextResponse.json({comparison});
 }catch(e){return error(e instanceof CreditError || e instanceof ProductSearchError?e.message:"Product comparison could not finish. Your existing bill is unchanged.", e instanceof CreditError ? 402 : 503);}
}
export async function PATCH(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(r))return error("Invalid request origin.",403);
 try{
  const user=await identity(r),db=await database(),{id}=await params;
  if(!user?.email||!db)return error("Sign in to update your bill.",401);
  const selection=z.object({index:z.number().int().min(0).max(39),url:z.string().url().max(2000)}).strict().safeParse(await r.json().catch(()=>null));
  if(!z.string().uuid().safeParse(id).success||!selection.success)return error("Choose a saved product.",400);
  await selectMaterialProduct(db,user.id,id,selection.data.index,selection.data.url);return NextResponse.json({saved:true});
 }catch(e){return error(e instanceof CreditError || e instanceof ProductSearchError?e.message:"Could not save this product.");}
}
