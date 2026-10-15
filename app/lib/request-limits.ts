export async function boundedRequestText(request: Request, maxBytes: number): Promise<string | null> {
  const declared=Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return null;
  if (!request.body) return "";
  const reader=request.body.getReader();
  const chunks: Uint8Array[]=[];
  let size=0;
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const joined=new Uint8Array(size); let offset=0;
    for(const chunk of chunks) { joined.set(chunk,offset); offset+=chunk.byteLength; }
    return new TextDecoder("utf-8",{fatal:true}).decode(joined);
  } catch { return null; }
  finally { reader.releaseLock(); }
}
