import { readCadBody } from "@/lib/cad/body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, sameOrigin, error } from "@/lib/server";
import { database, rateLimit } from "@/lib/database";
import { getCad, saveCad, cadHistory, cadAtRevision, CadConflict } from "@/lib/cad/store";
import { cadFromPlan, cadSchema } from "@/lib/cad/model";
const update=z.object({baseRevision:z.number().int().min(0),model:cadSchema.optional(),restoreRevision:z.number().int().positive().optional(),summary:z.string().max(240).default("Edited in room studio")}).strict();
export async function GET(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 try {const user=await identity(r),db=await database(),{id}=await params;
 if(!user?.email||!db)return error("Sign in to view your room model.",401);
 if(!z.string().uuid().safeParse(id).success)return error("Room not found.",404);
 const owned=await db.query("SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",[id,user.id]);if(!owned.rows.length)return error("Room not found.",404);
 let cad=await getCad(db,user.id,id);
 if(!cad){const old=await db.query("SELECT data FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='plan' ORDER BY created_at DESC LIMIT 1",[id,user.id]);if(old.rows[0])try{cad=await saveCad(db,user.id,id,0,cadFromPlan(old.rows[0].data),"user","Imported your existing floor plan");}catch(e){if(e instanceof CadConflict)cad=e.current;}}
 return NextResponse.json({cad,history:await cadHistory(db,user.id,id)},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return error("Could not load the room model.");}
}
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(r))return error("Invalid request origin.",403);
 try {const user=await identity(r),db=await database(),{id}=await params;if(!user?.email||!db)return error("Sign in to edit your room.",401);
 if(!z.string().uuid().safeParse(id).success)return error("Room not found.",404);
 const length=Number(r.headers.get("content-length")||0);if(length>100000)return error("Room model is too large.",413);
 const body=update.safeParse(await readCadBody(r).catch(()=>null));if(!body.success)return error("Add valid room geometry.",400);
 if(!(await rateLimit(`cad:${user.id}`,120,3600)))return error("Please wait before making more room edits.",429);
 const {baseRevision,restoreRevision,summary}=body.data;
 const model=restoreRevision?await cadAtRevision(db,user.id,id,restoreRevision):body.data.model;
 if(!model)return error("Room revision not found.",404);
 const cad=await saveCad(db,user.id,id,baseRevision,model,"user",restoreRevision?`Restored version ${restoreRevision}`:summary);
 return NextResponse.json({cad,history:await cadHistory(db,user.id,id)});
 }catch(e){if(e instanceof CadConflict)return NextResponse.json({error:e.message,cad:e.current},{status:409});return error(e instanceof Error?e.message:"Could not save your room model.",400);}
}
