import nodemailer from 'nodemailer';
import type {Queryable} from './repository';

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
const actionLabel=(subject:string)=>/confirm your .*email/i.test(subject)?'Confirm email':/reset your .*password/i.test(subject)?'Reset password':/sign.in link/i.test(subject)?'Sign in securely':null;
const preferredHost=()=>{try{return new URL(process.env.NEXT_PUBLIC_APP_URL||'https://archicova.com').host;}catch{return 'archicova.com';}};

/** Escape all user-controlled content and link only to our own configured domain. */
export function transactionalHtml(subject:string,text:string){
 const label=actionLabel(subject);
 const url=text.match(/https:\/\/[^\s<>]+/i)?.[0];
 let safeAction:string|undefined;
 if(url){try{const parsed=new URL(url);if(parsed.protocol==='https:'&&parsed.host===preferredHost())safeAction=parsed.toString();}catch{/* no action link */}}
 const linkedBody=escapeHtml(text).replace(/\n/g,'<br>');
 const action=label&&safeAction?`<p style="margin:27px 0 32px"><a href="${escapeHtml(safeAction)}" style="display:inline-block;padding:15px 23px;background:#213b2c;border-radius:9px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">${label} &rarr;</a></p>`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f7f8f4;color:#20352d;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(subject)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #e5e9e1;border-radius:15px;background:#fff"><tr><td style="padding:27px 34px;border-bottom:1px solid #e5e9e1;font-size:24px;font-weight:750;letter-spacing:-1px">Archicova</td></tr><tr><td style="padding:34px"><h1 style="font-family:Georgia,serif;font-size:29px;line-height:1.2;font-weight:normal;margin:0 0 20px">${escapeHtml(subject)}</h1><p style="font-size:15px;line-height:1.8;color:#516458;margin:0">${linkedBody}</p>${action}<p style="font-size:12px;line-height:1.7;color:#6c7a70;margin:24px 0 0">If you didn't request this message, you can safely ignore it. For assistance, contact <a style="color:#315d42" href="mailto:contact@archicova.com">contact@archicova.com</a>.</p></td></tr><tr><td style="border-top:1px solid #e5e9e1;padding:20px 34px;font-size:12px;color:#7a867b">Archicova · AI interior design and renovation planning<br><a href="https://archicova.com" style="color:#315d42">archicova.com</a></td></tr></table></td></tr></table></body></html>`;
}
export function mailConfigured(){return Boolean(process.env.EMAIL_FROM&&(process.env.SMTP_URL||process.env.RESEND_API_KEY)&&process.env.NEXT_PUBLIC_APP_URL);}
export async function sendMail(to:string,subject:string,text:string){
 if(!mailConfigured())throw new Error('Email delivery is not configured.');
 const html=transactionalHtml(subject,text);
 const replyTo=process.env.EMAIL_REPLY_TO||'contact@archicova.com';
 if(process.env.SMTP_URL){await nodemailer.createTransport(process.env.SMTP_URL).sendMail({from:process.env.EMAIL_FROM,to,replyTo,subject,text,html});return;}
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],reply_to:replyTo,subject,text,html}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Email delivery failed.');
}
export async function queueMail(db:Queryable,id:string,user:string,subject:string,body:string){await db.query('INSERT INTO roomwise.email_outbox(id,user_id,subject,body) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,user,subject,body]);}
export async function flushMail(db:Queryable,id:string){
 if(!mailConfigured())return false;
 const r=await db.query(`UPDATE roomwise.email_outbox SET status='sending',attempts=attempts+1,attempted_at=now() WHERE id=$1 AND (status IN ('pending','failed') OR (status='sending' AND attempted_at<now()-interval '5 minutes')) RETURNING *`,[id]);
 if(!r.rows[0])return (await db.query('SELECT status FROM roomwise.email_outbox WHERE id=$1',[id])).rows[0]?.status==='sent';
 try{const recipient=(await db.query('SELECT email FROM roomwise.users WHERE id=$1',[r.rows[0].user_id])).rows[0]?.email;await sendMail(recipient,r.rows[0].subject,r.rows[0].body);await db.query("UPDATE roomwise.email_outbox SET status='sent' WHERE id=$1",[id]);return true;}
 catch{await db.query("UPDATE roomwise.email_outbox SET status='failed' WHERE id=$1",[id]);return false;}
}
