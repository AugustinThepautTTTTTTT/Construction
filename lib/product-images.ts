import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  return isIP(address) === 6 && /^2[0-9a-f]{3}:/i.test(address);
}
export function imageUrl(value: string, page: string) {
  try {
    const u = new URL(value.replace(/&amp;|&#(?:38|x26);/gi, "&").replace(/&quot;|&#34;/gi, '"'), page);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      !isIP(u.hostname) &&
      !/(^|\.)localhost$|\.local$/i.test(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
function attributes(tag:string){
 const attrs:Record<string,string>={};
 for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4];
 return attrs;
}
export function productImage(html:string,page:string){
 const photo=(value:any):string|null=>Array.isArray(value)?value.map(photo).find(Boolean)||null:typeof value==='string'?imageUrl(value,page):value&&typeof value==='object'?photo(value.contentUrl||value.url||value['@id']):null;
 const walk=(value:any):string|null=>{
  if(!value||typeof value!=='object')return null;
  if([value['@type']].flat().some(type=>typeof type==='string'&&/(?:^|[\/#])Product$/.test(type))){const image=photo(value.image);if(image)return image;}
  for(const child of Object.values(value)){const image=walk(child);if(image)return image;}return null;
 };
 for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(attributes(script[1]).type!=='application/ld+json')continue;
  try{const image=walk(JSON.parse(script[2]));if(image)return image;}catch{}
 }
 for(const tag of html.matchAll(/<meta\b[^>]*>/gi)){
  const attrs=attributes(tag[0]);if(/^(og:image(?::secure_url)?|twitter:image)$/i.test(attrs.property||attrs.name||'')){const image=imageUrl(attrs.content||'',page);if(image)return image;}
 }
 for(const tag of html.matchAll(/<(?:img|link)\b[^>]*>/gi)){
  const attrs=attributes(tag[0]);if(attrs.itemprop==='image'||attrs.rel==='image_src'){const image=imageUrl(attrs.src||attrs['data-src']||attrs.href||'',page);if(image)return image;}
 }
 return null;
}
// DNS is checked and pinned at every hop, including retailer CDN redirects.
export async function publicResource(url:string,accept:string,maxBytes:number,redirects=0):Promise<{body:Buffer;type:string;url:string}|null>{
 try{
  if(!imageUrl(url,url))return null;
  const u=new URL(url),addresses=await lookup(u.hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return null;
  const address=addresses.find(a=>a.family===4)||addresses[0];
  const result=await new Promise<{body?:Buffer;type?:string;redirect?:string}>((resolve,reject)=>{
   const req=https.get(u,{lookup:((_host:any,options:any,cb:any)=>options.all?cb(null,[address]):cb(null,address.address,address.family)) as any,headers:{'User-Agent':'Archicova/1.0 product preview',Accept:accept,'Accept-Encoding':'identity'}},res=>{
    if(res.statusCode&&res.statusCode>=300&&res.statusCode<400){res.resume();resolve({redirect:res.headers.location});return;}
    if(res.statusCode!==200){res.resume();resolve({});return;}
    const chunks:Buffer[]=[];let bytes=0;
    res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>maxBytes){res.destroy();resolve({});}else chunks.push(chunk);});
    res.on('end',()=>resolve({body:Buffer.concat(chunks),type:res.headers['content-type']||''}));res.on('error',reject);
   });
   const deadline=setTimeout(()=>req.destroy(new Error('timeout')),5000);req.on('close',()=>clearTimeout(deadline));req.on('error',reject);
  });
  if(result.redirect&&redirects<2)return publicResource(new URL(result.redirect,u).href,accept,maxBytes,redirects+1);
  return result.body?{body:result.body,type:result.type||'',url}:null;
 }catch{return null;}
}
export async function fetchProductImage(page:string):Promise<string|null>{
 const result=await publicResource(page,'text/html',2000000);
 return result?.type.includes('text/html')?productImage(result.body.toString('utf8'),result.url):null;
}
