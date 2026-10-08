import {z} from 'zod';
export const ROOM_TYPES=['Bathroom','Kitchen','Living room','Bedroom'] as const;
export type Inspiration={id:string;room:typeof ROOM_TYPES[number];title:string;style:string;image:string;source:string;palette:string[];materials:string[];direction:string;scope:string};
const entries:[string,Inspiration['room'],string,string,string,string[],string[],string][]=[
 ['bathroom-spa','Bathroom','A quieter morning','Natural','bathroom',['#e5dfd0','#bca784','#f5f2ea'],['warm stone','oak accents','brushed fixtures'],'Soft warm neutrals, tactile finishes and uncluttered storage'],
 ['bathroom-contrast','Bathroom','Quiet contrast','Contemporary','bathroom2',['#dddcd5','#343c3c','#a38d72'],['light tiles','dark fixtures','wood vanity'],'Balance pale surfaces with restrained dark accents'],
 ['kitchen-warm','Kitchen','Gather around','Natural','kitchen',['#e5dccb','#b18b65','#f7f5ed'],['wood cabinetry','warm white walls','stone-look surfaces'],'Warm wood, a clean working surface and practical storage'],
 ['kitchen-soft','Kitchen','A fresh start','Minimal','kitchen2',['#efeee6','#bac0ae','#c9b398'],['painted cabinetry','matte finish','simple handles'],'Quiet colour, clean fronts and considered lighting'],
 ['living-natural','Living room','Space to breathe','Natural','living',['#e9e2d5','#9d977b','#ba9772'],['linen','wood','textured soft furnishings'],'Layer warm neutrals, natural textures and comfortable seating'],
 ['living-bold','Living room','A little character','Contemporary','living2',['#dfd8c8','#596856','#ad7962'],['warm wood','muted colour','textile accents'],'Introduce a controlled accent palette while keeping existing room geometry'],
 ['bedroom-calm','Bedroom','Rest, beautifully','Minimal','bedroom',['#eee9df','#bcb19f','#747c70'],['linen bedding','warm lighting','wood furniture'],'A restrained palette, soft light and useful bedside storage'],
 ['bedroom-layered','Bedroom','Warm and personal','Natural','bedroom2',['#e7dfcf','#b28b6c','#75836e'],['layered textiles','wood','muted accents'],'Build warmth through reversible textile and lighting choices'],
];
export const IMAGE_SOURCES:Record<string,string>={bathroom:'photo-1620626011761-996317b8d101',bathroom2:'photo-1584622650111-993a426fbf0a',kitchen:'photo-1556912172-45b7abe8b7e1',kitchen2:'photo-1556911220-bff31c812dba',living:'photo-1600210492486-724fe5c67fb0',living2:'photo-1616486338812-3dadae4b4ace',bedroom:'photo-1611892440504-42a792e24d32',bedroom2:'photo-1616594039964-ae9021a400a0'};
export const INSPIRATIONS:Inspiration[]=entries.map(([id,room,title,style,image,palette,materials,direction])=>({id,room,title,style,image:`/inspiration/${image}.jpg`,source:`https://images.unsplash.com/${IMAGE_SOURCES[image]}`,palette,materials,direction,scope:'Decorative reference; retain the actual room architecture. Adapt to the user’s budget, existing finishes and feasibility.'}));
export const inspirationRoomSchema=z.enum([...ROOM_TYPES,'All']);
export const openInspirationSchema=z.object({room:inspirationRoomSchema}).strict();
export const inspirationSelectionSchema=z.object({ids:z.array(z.string().refine(id=>INSPIRATIONS.some(ref=>ref.id===id),'Choose a library reference')).max(3).refine(ids=>new Set(ids).size===ids.length),skipped:z.boolean()}).strict().refine(value=>value.skipped?value.ids.length===0:value.ids.length>0);
export function inspirationProfile(ids:string[]){
 const references=ids.map(id=>{const ref=INSPIRATIONS.find(ref=>ref.id===id);if(!ref)throw Error('Unknown inspiration reference.');return ref;});
 return {references:references.map(({id,room,title,style,direction,scope})=>({id,room,title,style,direction,scope})),palette:[...new Set(references.flatMap(ref=>ref.palette))],materials:[...new Set(references.flatMap(ref=>ref.materials))],notice:'Style guidance, not the user’s room. Preserve actual geometry and explicit choices; do not infer measurements, purchases or completed work.'};
}
