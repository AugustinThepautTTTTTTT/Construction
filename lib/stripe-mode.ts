// Each deployment opts into live billing explicitly; development defaults to test.
export function stripeMode(): 'test' | 'live' {
 const mode=process.env.STRIPE_MODE || 'test';
 if(mode!=='test' && mode!=='live')throw new Error('Invalid billing mode.');
 return mode;
}
export function stripeLive(){return stripeMode()==='live';}
export function stripeKeyConfigured(){
 return new RegExp(`^(sk|rk)_${stripeMode()}_`).test(process.env.STRIPE_SECRET_KEY || '');
}
