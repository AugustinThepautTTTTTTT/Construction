import {NextRequest,NextResponse} from 'next/server';
import {database,rateLimit} from '@/lib/database';
import {identity,sameOrigin,error,digest,newSession,sessionCookie} from '@/lib/server';
import {requestConfirmation} from '@/lib/email-confirmation';
import {mailConfigured} from '@/lib/mail';
export async function POST(r:NextRequest){
 if(!sameOrigin(r))return error('Invalid request origin.',403);
 const db=await database(),user=await identity(r);if(!db||!user?.email)return error('Sign in first.',401);
 if(user.email_verified)return NextResponse.json({verified:true});
 if(!mailConfigured())return error('Confirmation emails are temporarily unavailable.');
 if(!await rateLimit(`verify:${user.id}`,3,3600))return error('Please wait before requesting another email.',429);
 return await requestConfirmation(db,user.id)?NextResponse.json({sent:true}):error('Your confirmation email could not be sent. Please retry.');
}
export async function GET(r:NextRequest){
 const token=r.nextUrl.searchParams.get('token');const destination=new URL('/account?verified=1',r.url);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return NextResponse.redirect(new URL('/account?error=expired',r.url));
 const db=await database();if(!db)return error('Account confirmation is temporarily unavailable.');
 const c=await db.connect();let user;
 try{await c.query('BEGIN');const found=await c.query('DELETE FROM roomwise.email_verifications WHERE token_hash=$1 AND expires_at>now() RETURNING user_id',[digest(token)]);user=found.rows[0]?.user_id;if(!user){await c.query('ROLLBACK');return NextResponse.redirect(new URL('/account?error=expired',r.url));}await c.query('UPDATE roomwise.users SET email_verified=true WHERE id=$1',[user]);await c.query('DELETE FROM roomwise.sessions WHERE user_id=$1',[user]);await c.query('COMMIT');}catch{await c.query('ROLLBACK');return error('Account confirmation could not finish.');}finally{c.release();}
 const session=await newSession(user);return sessionCookie(NextResponse.redirect(destination),session.token);
}
