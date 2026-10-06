import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { identity,error } from "@/lib/server";
import { database } from "@/lib/database";
import { projectAssets } from "@/lib/project-assets";
export async function GET(r:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const user=await identity(r),db=await database(),{id}=await params;if(!user?.email||!db)return error("Sign in to view your project.",401);
 if(!z.string().uuid().safeParse(id).success)return error("Project not found.",404);
 const assets=await projectAssets(db,user.id,id);return assets?NextResponse.json(assets,{headers:{"Cache-Control":"private, no-store"}}):error("Project not found.",404);
}catch{return error("Could not load your project.");}}
