import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {identity,sameOrigin,error} from '@/lib/server';
import {database} from '@/lib/database';
import {projectEditSchema,editProjectDeliverable} from '@/lib/project-edits';
import {ProductSearchError} from '@/lib/material-research';
export async function PATCH(r:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(r))return error('Invalid request origin.',403);
 try{
  const user=await identity(r),db=await database(),{id}=await params;
  if(!user?.email||!db)return error('Sign in to update your project.',401);
  const parsed=projectEditSchema.safeParse(await r.json().catch(()=>null));
  if(!z.string().uuid().safeParse(id).success||!parsed.success)return error('Check the project details.',400);
  await editProjectDeliverable(db,user.id,id,parsed.data);return NextResponse.json({saved:true});
 }catch(e){return error(e instanceof ProductSearchError?e.message:'Could not save your project changes.');}
}
