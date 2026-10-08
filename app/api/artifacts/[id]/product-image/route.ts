import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {identity,error} from '@/lib/server';
import {database} from '@/lib/database';
import {productThumbnail} from '@/lib/product-thumbnails';
export const maxDuration=45;
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,user=await identity(request),db=await database();
  if(!user?.email||!db)return error('Sign in to view this product.',401);
  const query=z.object({id:z.string().uuid(),index:z.coerce.number().int().min(0).max(39),position:z.coerce.number().int().min(0).max(5)}).safeParse({id,index:request.nextUrl.searchParams.get('index')??'invalid',position:request.nextUrl.searchParams.get('position')??'invalid'});
  if(!query.success)return error('Product not found.',404);
  const result=await db.query("SELECT data FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='estimate'",[id,user.id]);
  const source=result.rows[0]?.data?.productComparisons?.[query.data.index]?.products?.[query.data.position];
  if(!source?.url)return error('Product not found.',404);
  const thumbnail=await productThumbnail(source);
  if(!thumbnail)return NextResponse.json({error:'The retailer did not provide an accessible preview.'},{status:404,headers:{'Cache-Control':'private, no-store'}});
  return new NextResponse(new Uint8Array(thumbnail.bytes),{headers:{'Content-Type':thumbnail.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return error('Product preview unavailable.',404);}
}
