'use client';
import React,{useEffect,useState} from 'react';
import {ImageOff} from 'lucide-react';
import type {PriceSource} from '@/lib/room-artifacts';
export function ProductThumbnail({billId,index,position,source}:{billId:string;index:number;position:number;source:PriceSource}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[billId,index,position,source.url,source.imageUrl]);
 const privateBill=/^[0-9a-f-]{36}$/i.test(billId);
 const src=privateBill?`/api/artifacts/${billId}/product-image?index=${index}&position=${position}`:source.imageUrl;
 return <div className="marketProductImage">{src&&!failed?<img key={src} src={src} alt={source.title} loading="lazy" onError={()=>setFailed(true)}/>:<div className="marketImageUnavailable"><ImageOff size={28}/><span>Preview unavailable</span><a href={source.url} target="_blank" rel="noopener noreferrer">See photo at store</a></div>}</div>;
}
