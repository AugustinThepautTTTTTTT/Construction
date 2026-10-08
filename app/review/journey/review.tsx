"use client";
import React,{useState} from 'react';
import {InspirationLibrary} from '@/components/inspiration-library';
import {ConstructionPlanView} from '@/components/construction-plan';
export default function JourneyReview(){
 const [narrow,setNarrow]=useState(false),[request,setRequest]=useState('');
 const artifact:any={id:'synthetic-reference',kind:'inspiration',data:{room:'All',selectedIds:[],confirmed:false}};
 const works:any={id:'synthetic-plan',kind:'construction',data:{title:'A simple wall refresh',overview:'Synthetic work plan for interface review.',estimateId:'synthetic-bill',completedSteps:{0:true},assumptions:[],steps:[{title:'Prepare the wall',instructions:['Protect the floor and clean the sound wall.'],checks:['Dry and dust-free'],dependsOn:[],duration:'1 hour',dryingTime:'Allow to dry',professionalRequired:false,materials:[]},{title:'Apply the finish',instructions:['Follow the chosen paint’s label. Work in manageable sections.'],checks:['Consistent finish'],dependsOn:[0],duration:'2 hours',dryingTime:'Follow product label',professionalRequired:false,materials:[]}]}};
 return <main style={{maxWidth:800,margin:'32px auto',padding:16}}><h1>Renovation journey · dev review</h1><p>Fixed library and synthetic work plan. This page changes no customer records and makes no AI calls.</p><button onClick={()=>setNarrow(!narrow)}>{narrow?'Show wide layout':'Show narrow panel'}</button><div className="chatKit" style={{display:'block',width:narrow?360:720,maxWidth:'100%',margin:'0 auto',height:'auto',minHeight:0}}><InspirationLibrary artifact={artifact} onChanged={()=>{}} saveSelection={async()=>{}} onRequest={setRequest}/><ConstructionPlanView artifact={works} compact chat onRequest={setRequest}/>{request&&<p role="status">Button request preview: {request}</p>}</div></main>;
}
