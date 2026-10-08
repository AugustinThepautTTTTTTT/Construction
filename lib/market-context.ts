export type MarketContext={city:string;country:string|null;currency:string|null};
export function assertMarketMatches(bill:{city:string;country:string;currency:string},market:MarketContext|null){
 if(!market?.country||!market.currency)throw new Error('Please confirm the renovation city and country before estimating or searching local prices.');
 if(bill.country!==market.country||bill.currency!==market.currency||bill.city.trim().toLocaleLowerCase()!==market.city.trim().toLocaleLowerCase())throw new Error(`This bill uses a different location. Please regenerate the local estimate for ${market.city}, ${market.country} in ${market.currency} before searching. Foreign prices cannot be relabelled.`);
}
