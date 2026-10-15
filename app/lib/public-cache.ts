// Bounded per-isolate cache/single-flight. This reduces upstream fan-out; it is
// not a substitute for hosting-level abuse controls or a global DDoS guarantee.
export function createPublicCache(maxEntries=48, ttlMs=120_000, missesPerMinute=24, now=Date.now) {
  const entries=new Map<string,{expires:number;promise:Promise<unknown>}>();
  let windowStart=0, misses=0;
  return async function cached<T>(key:string, fetcher:()=>Promise<T>):Promise<T> {
    const time=now();
    const hit=entries.get(key);
    if(hit && hit.expires>time) return hit.promise as Promise<T>;
    if(time-windowStart>=60_000) { windowStart=time;misses=0; }
    if(misses>=missesPerMinute) throw new Error("Public source refresh budget reached");
    misses++;
    for(const [k,v] of entries) if(v.expires<=time) entries.delete(k);
    while(entries.size>=maxEntries) entries.delete(entries.keys().next().value!);
    const promise=Promise.resolve().then(fetcher);
    entries.set(key,{expires:time+ttlMs,promise});
    try { return await promise; }
    catch(error) { if(entries.get(key)?.promise===promise) entries.delete(key); throw error; }
  };
}
export const cachedPublicSource=createPublicCache();
