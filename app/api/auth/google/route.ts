import {randomBytes,createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {googleConfigured} from '@/lib/google-auth';
import {safeNext} from '@/lib/domain';
import {rateLimit} from '@/lib/database';
import {digest,requestIp} from '@/lib/server';
export async function GET(r:NextRequest){
 if(!googleConfigured())return NextResponse.redirect(new URL('/account?error=google_unavailable',r.url));
 if(!await rateLimit(`oauth:${digest(requestIp(r))}`,20,900))return NextResponse.redirect(new URL('/account?error=rate_limit',r.url));
 const state=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');const redirect=new URL('/api/auth/google/callback',process.env.NEXT_PUBLIC_APP_URL!).toString();
 Object.entries({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:redirect,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=NextResponse.redirect(url);response.cookies.set('roomwise_oauth',JSON.stringify({state,nonce,verifier,next:safeNext(r.nextUrl.searchParams.get('next'))}),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:600,path:'/api/auth/google'});return response;
}
