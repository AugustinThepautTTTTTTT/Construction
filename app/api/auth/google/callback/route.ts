import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {database} from '@/lib/database';
import {newSession,sessionCookie} from '@/lib/server';
import {safeNext} from '@/lib/domain';
import {googleKeys,verifyGoogleToken,googleConfigured} from '@/lib/google-auth';
export async function GET(r:NextRequest){
 const fail=()=>{const res=NextResponse.redirect(new URL('/account?error=google',r.url));res.cookies.set('roomwise_oauth','',{path:'/api/auth/google',maxAge:0});return res;};
 try{const data=JSON.parse(r.cookies.get('roomwise_oauth')?.value||'{}'),code=r.nextUrl.searchParams.get('code');if(!googleConfigured()||!code||!data.state||data.state!==r.nextUrl.searchParams.get('state'))return fail();
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:new URL('/api/auth/google/callback',process.env.NEXT_PUBLIC_APP_URL!).toString(),grant_type:'authorization_code',code_verifier:data.verifier}),signal:AbortSignal.timeout(15000)});if(!response.ok)return fail();
 const tokens=await response.json(),claims=verifyGoogleToken(tokens.id_token,await googleKeys(),process.env.GOOGLE_CLIENT_ID!,data.nonce);
 const db=await database();if(!db)return fail();const c=await db.connect();let user;
 try{await c.query('BEGIN');const existing=(await c.query('SELECT * FROM roomwise.users WHERE google_id=$1 OR email=$2 FOR UPDATE',[claims.sub,claims.email.toLowerCase()])).rows[0];
 if(existing){if(existing.google_id&&existing.google_id!==claims.sub)throw new Error('Identity mismatch');
 // Google is authoritative for Gmail/Workspace emails only. For third-party
 // addresses require the existing user's verified email before linking.
 if(!existing.google_id&&!claims.email.endsWith('@gmail.com')&&!claims.hd)throw new Error('Sign in with your password before linking Google');
 user=existing.id;await c.query('UPDATE roomwise.users SET google_id=$1,email_verified=true,password_hash=CASE WHEN email_verified THEN password_hash ELSE NULL END WHERE id=$2',[claims.sub,user]);if(!existing.email_verified)await c.query('DELETE FROM roomwise.sessions WHERE user_id=$1',[user]);
 }else{user=randomUUID();await c.query('INSERT INTO roomwise.users(id,email,name,email_verified,google_id) VALUES($1,$2,$3,true,$4)',[user,claims.email.toLowerCase(),(claims.name||'').slice(0,80),claims.sub]);}await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 const session=await newSession(user),res=sessionCookie(NextResponse.redirect(new URL(safeNext(data.next),process.env.NEXT_PUBLIC_APP_URL!)),session.token);res.cookies.set('roomwise_oauth','',{path:'/api/auth/google',maxAge:0});return res;
 }catch{return fail();}
}
