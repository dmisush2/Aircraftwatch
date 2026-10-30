import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBucket} from '../lib/bucket.mjs';
import {authorize} from '../lib/auth.mjs';
import {runMonitor} from '../lib/monitor-run.mjs';
const origin='https://example.netlify.app';
const entries=new Map();let revision=0;
const store={async getWithMetadata(k){return entries.get(k)||null},async set(k,data,o={}){const current=entries.get(k);if(o.onlyIfNew&&current||o.onlyIfMatch&&current?.etag!==o.onlyIfMatch)return {modified:false};const etag=String(++revision);entries.set(k,{data,etag});return {modified:true,etag}},async delete(k){entries.delete(k)}};
test('Authentication fails closed and rejects incorrect credentials',()=>{
 assert.equal(authorize(new Request(origin),{}).status,503);
 const env={APP_USERNAME:'owner',APP_PASSWORD:'test-only'};
 assert.equal(authorize(new Request(origin),env).status,401);
 assert.equal(authorize(new Request(origin,{headers:{Authorization:'Basic '+Buffer.from('owner:test-only').toString('base64')}}),env),null);
});
test('Storage adapter atomically rejects concurrent stale writes',async()=>{
 entries.clear();const b=createBucket(store);assert.ok(await b.put('ui','one',{onlyIf:{etagDoesNotMatch:'*'}}));
 assert.equal(await b.put('ui','overwrite',{onlyIf:{etagDoesNotMatch:'*'}}),null);
 const first=await b.get('ui');assert.equal(await first.text(),'one');
 const writes=await Promise.all([b.put('ui','two',{onlyIf:{etagMatches:first.etag}}),b.put('ui','three',{onlyIf:{etagMatches:first.etag}})]);
 assert.equal(writes.filter(Boolean).length,1);
});
test('Scheduler without Telegram credentials makes no API calls',async()=>{
 assert.deepEqual(await runMonitor({},{}),{skipped:'Telegram credentials not configured'});
});
test('Telegram deliveries are retried on failure and successful events deduplicated',async()=>{
 entries.clear();const env={BUCKET:createBucket(store)};let calls=0;
 const worker={fetch:async()=>Response.json({events:[{id:'test-event',text:'test'}]})};
 const fetcher=async()=>{calls++;return Response.json({ok:true})};
 const options={worker,fetcher,token:'test',chatId:'test'};
 assert.equal((await runMonitor(env,options)).sent,1);
 assert.equal((await runMonitor(env,options)).sent,0);assert.equal(calls,1);
 entries.clear();await assert.rejects(runMonitor(env,{...options,fetcher:async()=>Response.json({ok:false})}),/Telegram delivery failed/);
 assert.equal((await runMonitor(env,options)).sent,1);
});
test('Netlify route serves protected HTML and APIs through actual worker',async()=>{
 const {default:app}=await import('../lib/generated-worker.mjs');entries.clear();const env={BUCKET:createBucket(store)};
 const page=await app.fetch(new Request(origin+'/'),env);assert.equal(page.status,200);assert.match(await page.text(),/YYZ Aircraft Watch/);
 const missing=await app.fetch(new Request(origin+'/api/aircraft',{method:'POST',body:'{}'}),env);assert.equal(missing.status,503);
 const save=await app.fetch(new Request(origin+'/api/ui-state',{method:'POST',headers:{Origin:origin},body:JSON.stringify({baseRevision:0,changes:[{key:'yyz-watchlist',before:null,value:'["N123AB"]'}]})}),env);assert.equal(save.status,200);
 const read=await app.fetch(new Request(origin+'/api/ui-state'),env);assert.equal((await read.json()).data['yyz-watchlist'],'["N123AB"]');
 const stale=await app.fetch(new Request(origin+'/api/ui-state',{method:'POST',headers:{Origin:origin},body:JSON.stringify({baseRevision:0,changes:[]})}),env);assert.equal(stale.status,409);
});
