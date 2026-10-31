import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {identity,error,sameOrigin} from "@/lib/server";
import {database} from "@/lib/database";
import {loadWorkspace,changeWorkspace,changeSchema} from "@/lib/renovation-workspace";
type Context={params:Promise<{id:string}>};
async function auth(r:NextRequest,ctx:Context){
 const {id}=await ctx.params,db=await database(),user=await identity(r);
 if(!db||!user?.email||!z.string().uuid().safeParse(id).success)return null;
 const found=await db.query("SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",[id,user.id]);
 return found.rows.length?{db,user,id}:null;
}
export async function GET(r:NextRequest,ctx:Context){
 try{const a=await auth(r,ctx);if(!a)return error("Project not found or sign-in required.",404);return NextResponse.json(await loadWorkspace(a.db,a.user.id,a.id),{headers:{"Cache-Control":"private, no-store"}});}
 catch{return error("Could not load renovation workspace.");}
}
export async function PATCH(r:NextRequest,ctx:Context){
 if(!sameOrigin(r))return error("Invalid request origin.",403);
 try{
  const a=await auth(r,ctx);if(!a)return error("Project not found or sign-in required.",404);
  const payload=z.object({revision:z.number().int().min(0),change:changeSchema}).strict().safeParse(await r.json().catch(()=>null));
  if(!payload.success)return error("Invalid workspace update.",400);
  const state=await changeWorkspace(a.db,a.user.id,a.id,payload.data.change,payload.data.revision);
  return NextResponse.json(state,{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){const message=e instanceof Error?e.message:"Could not save the renovation workspace.";
  return error(message.includes("changed")?message:"Could not save the renovation workspace.",message.includes("changed")?409:500);}
}
