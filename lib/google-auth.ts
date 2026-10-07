import {createPublicKey,verify} from 'node:crypto';
import {z} from 'zod';
let cached:{keys:any[];expires:number}|undefined;
export function googleConfigured(){return Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.NEXT_PUBLIC_APP_URL);}
export function verifyGoogleToken(token:string,keys:any[],audience:string,nonce:string,now=Date.now()){
 const parts=token.split('.');if(parts.length!==3)throw new Error('Invalid identity token');
 const header=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(header.alg!=='RS256')throw new Error('Invalid algorithm');
 const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw new Error('Unknown signing key');
 const key=createPublicKey({key:jwk,format:'jwk'});
 if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url')))throw new Error('Invalid signature');
 const claims=z.object({iss:z.enum(['https://accounts.google.com','accounts.google.com']),aud:z.literal(audience),exp:z.number(),iat:z.number(),nonce:z.literal(nonce),sub:z.string().min(1).max(255),email:z.string().email().max(254),email_verified:z.literal(true),name:z.string().max(200).optional(),hd:z.string().optional()}).parse(JSON.parse(Buffer.from(parts[1],'base64url').toString()));
 if(claims.exp*1000<=now||claims.iat*1000>now+60000)throw new Error('Expired identity token');
 return claims;
}
export async function googleKeys(){
 if(cached&&cached.expires>Date.now())return cached.keys;
 const r=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Identity verification unavailable');const data=await r.json();cached={keys:data.keys,expires:Date.now()+300000};return cached.keys;
}
