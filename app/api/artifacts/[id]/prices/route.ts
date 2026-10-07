import {CreditError} from "@/lib/credits";
import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { identity,sameOrigin,error } from "@/lib/server";
import { database } from "@/lib/database";
import { searchMaterialProduct,selectMaterialProduct,ProductSearchError } from "@/lib/material-research";
export const maxDuration=180;
const lookup=z.object({index:z.number().int().min(0).max(39),preferences:z.string().max(500).default("")}).strict();
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(r))return error("Invalid request origin.",403);
 try{
  const user=await identity(r),db=await database(),{id}=await params;
  if(!user?.email||!db)return error("Sign in to compare products.",401);
  if(!z.string().uuid().safeParse(id).success)return error("Bill not found.",404);
  const body=lookup.safeParse(await r.json().catch(()=>null));if(!body.success)return error("Select one material item to research.",400);
  const result=await db.query("SELECT a.data,p.paid FROM roomwise.artifacts a JOIN roomwise.projects p ON p.id=a.project_id WHERE a.id=$1 AND a.user_id=$2 AND a.kind='estimate'",[id,user.id]);
  if(!result.rows.length)return error("Bill not found.",404);

  const comparison=await searchMaterialProduct(db,user.id,id,result.rows[0].data,body.data.index,body.data.preferences);
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
