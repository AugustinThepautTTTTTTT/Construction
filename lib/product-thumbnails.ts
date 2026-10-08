import sharp from 'sharp';
import {fetchProductImage,publicResource} from './product-images';
type Thumbnail={bytes:Buffer;type:string};
const cache=new Map<string,{expires:number;value:Thumbnail|null}>();
const pending=new Map<string,Promise<Thumbnail|null>>();
export async function productThumbnail(source:{url:string;imageUrl?:string}):Promise<Thumbnail|null>{
 const key=`${source.url}|${source.imageUrl||''}`,cached=cache.get(key);
 if(cached&&cached.expires>Date.now())return cached.value;
 if(pending.has(key))return pending.get(key)!;
 const request=(async()=>{
  let value:Thumbnail|null=null;
  try{
   const load=async(image:string)=>{
    const result=await publicResource(image,'image/avif,image/webp,image/png,image/jpeg,image/gif',4000000);
    if(result&&/^image\/(?:jpeg|png|webp|gif|avif)(?:;|$)/i.test(result.type)){
     const bytes=await sharp(result.body,{limitInputPixels:40000000}).rotate().resize(800,600,{fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
     return {bytes,type:'image/webp'};
    }return null;
   };
   if(source.imageUrl)value=await load(source.imageUrl).catch(()=>null);
   if(!value){const image=await fetchProductImage(source.url);if(image&&image!==source.imageUrl)value=await load(image);}

  }catch{}
  if(cache.size>=128)cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+(value?86400000:600000),value});return value;
 })();
 pending.set(key,request);try{return await request;}finally{pending.delete(key);}
}
