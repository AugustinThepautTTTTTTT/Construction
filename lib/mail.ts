import nodemailer from 'nodemailer';
import type {Queryable} from './repository';
export function mailConfigured(){return Boolean(process.env.EMAIL_FROM&&(process.env.SMTP_URL||process.env.RESEND_API_KEY)&&process.env.NEXT_PUBLIC_APP_URL);}
export async function sendMail(to:string,subject:string,text:string){
 if(!mailConfigured())throw new Error('Email delivery is not configured.');
 if(process.env.SMTP_URL){await nodemailer.createTransport(process.env.SMTP_URL).sendMail({from:process.env.EMAIL_FROM,to,subject,text});return;}
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(15000)});
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
