// Original icons exported from the user's Figma chat reference. Preserve SVG
// root dimensions; scale the image visually inside the requested control slot.
const assets={"new-chat":{width:9,height:9},sidebar:{width:8,height:6},attach:{width:6,height:6},copy:{width:7,height:7}};
export function ChatIcon({name,size=18}:{name:keyof typeof assets;size?:number}){
 const asset=assets[name];
 return <span className="chatIcon" aria-hidden="true" style={{width:size,height:size,display:"inline-grid",placeItems:"center",flexShrink:0}}><img src={`/chat-ui/${name}.svg`} alt="" width={asset.width} height={asset.height} style={{display:"block",maxWidth:"none",transform:`scale(${size/Math.max(asset.width,asset.height)})`}}/></span>;
}
