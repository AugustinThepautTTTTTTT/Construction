import {z} from 'zod';
import {database,getPool} from '../lib/database';
import {grantAccountCredits} from '../lib/account-credit-grants';
async function main(){
 const raw=process.env.ROOMWISE_ACCOUNT_CREDIT_GRANT;if(!raw)return;
 const request=z.object({email:z.string().email(),amount:z.number().int().positive(),operation:z.string()}).strict().parse(JSON.parse(raw));
 const db=await database();if(!db)throw new Error('Credit grant requires PostgreSQL');
 const result=await grantAccountCredits(db,request.email,request.amount,request.operation);
 console.log('Roomwise requested account credit grant:',JSON.stringify(result));
}
main().catch(()=>{console.error('Roomwise requested account credit grant failed. No account credentials were exposed.');process.exitCode=1;}).finally(async()=>{await getPool()?.end();});
