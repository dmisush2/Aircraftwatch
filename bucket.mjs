// R2-compatible subset, with atomic ETag checks preserved for cloud sync.
export function createBucket(store){return {
 async get(key){const entry=await store.getWithMetadata(key,{type:'text',consistency:'strong'});if(!entry)return null;return {etag:entry.etag,text:async()=>entry.data,json:async()=>JSON.parse(entry.data)}},
 async put(key,value,options={}){const condition=options.onlyIf;const opts=condition?.etagMatches?{onlyIfMatch:condition.etagMatches}:condition?.etagDoesNotMatch==='*'?{onlyIfNew:true}:{};const result=await store.set(key,value,opts);return result.modified?{etag:result.etag}:null},
 async delete(key){await store.delete(key)}
}}
