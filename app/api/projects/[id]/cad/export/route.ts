import { NextRequest,NextResponse } from "next/server";
import { identity,error } from "@/lib/server";
import { database } from "@/lib/database";
import { getCad } from "@/lib/cad/store";
import { cadPythonSource } from "@/lib/cad/source-export";
import { z } from "zod";
export async function GET(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const user=await identity(r),db=await database(),{id}=await params;if(!user?.email||!db)return error("Sign in to export your room.",401);if(!z.string().uuid().safeParse(id).success)return error("Room not found.",404);
 const cad=await getCad(db,user.id,id);if(!cad)return error("Room model not found.",404);
 const python=r.nextUrl.searchParams.get("format")==="python";
 return new NextResponse(python?cadPythonSource(cad.model):JSON.stringify(cad,null,2),{headers:{"Content-Type":python?"text/x-python; charset=utf-8":"application/json","Content-Disposition":`attachment; filename="${python?"room.py":"roomwise-room.json"}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return error("Could not export this room.");}
}
