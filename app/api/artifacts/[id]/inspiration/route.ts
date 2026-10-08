import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {identity,sameOrigin,error} from '@/lib/server';
import {database} from '@/lib/database';
import {inspirationSelectionSchema,inspirationProfile} from '@/lib/inspiration-library';
export async function PATCH(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(r))return error('Invalid request origin.',403);
 try{
  const user=await identity(r),db=await database(),{id}=await params;
  if(!user?.email||!db)return error('Sign in to save your references.',401);
  const selected=inspirationSelectionSchema.safeParse(await r.json().catch(()=>null));
  if(!z.string().uuid().safeParse(id).success||!selected.success)return error('Choose up to three library references or skip.',400);
  const result=await db.query("UPDATE roomwise.artifacts SET data=data || $1::jsonb WHERE id=$2 AND user_id=$3 AND kind='inspiration' RETURNING id",[JSON.stringify({selectedIds:selected.data.ids,skipped:selected.data.skipped,confirmed:true,profile:inspirationProfile(selected.data.ids)}),id,user.id]);
  return result.rows.length?NextResponse.json({saved:true}):error('Reference library not found.',404);
 }catch{return error('Could not save your references. Please retry.');}
}
