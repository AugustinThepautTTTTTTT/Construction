import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyGoogleToken} from '../lib/google-auth';
test('Google identity requires a real signature, correct audience/nonce/issuer, verified email and unexpired claims',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const keys=[{...publicKey.export({format:'jwk'}),kid:'test'}],now=Date.now();
 const claims={iss:'https://accounts.google.com',aud:'client',exp:now/1000+300,iat:now/1000,nonce:'once',sub:'google-user',email:'person@gmail.com',email_verified:true};
 const token=(value:any)=>{const data=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(value)).toString('base64url');return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');};
 assert.equal(verifyGoogleToken(token(claims),keys,'client','once',now).sub,'google-user');
 for(const changed of [{aud:'other'},{nonce:'other'},{iss:'https://attacker.com'},{exp:now/1000-1},{email_verified:false}])assert.throws(()=>verifyGoogleToken(token({...claims,...changed}),keys,'client','once',now));
 const parts=token(claims).split('.');parts[1]=Buffer.from(JSON.stringify({...claims,sub:'forged'})).toString('base64url');assert.throws(()=>verifyGoogleToken(parts.join('.'),keys,'client','once',now),/signature/);
});
