export async function readCadBody(request: Request) {
  if (!request.body) return null;
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000){await reader.cancel();throw new Error("Room model is too large (100 KB maximum).");}chunks.push(value);} }
  finally {reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
