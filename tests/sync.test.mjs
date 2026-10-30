import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const server=vm.createContext({Response,Request,URL,Headers,Date,Set,Map,JSON});vm.runInContext(fs.readFileSync('worker/sync.js','utf8'),server);
let content=null,etag=0;const bucket={async get(){const text=content,version=String(etag);return text?{etag:version,text:async()=>text}:null},async put(key,value,options){if(options.onlyIf.etagMatches!==undefined&&options.onlyIf.etagMatches!==String(etag)||options.onlyIf.etagDoesNotMatch==='*'&&content!==null)return null;content=value;etag++;return {etag:String(etag)}}};
const send=async(body,origin='https://app.test')=>server.uiStateApi(new Request('https://app.test/api/ui-state',{method:body?'POST':'GET',headers:{Origin:origin},body:body?JSON.stringify(body):undefined}),{BUCKET:bucket});
assert.equal((await send()).status,200);assert.equal((await send({baseRevision:0,changes:[]},'https://other.test')).status,403);
const zone=id=>({id,name:id,kind:'circle',center:[43.7,-79.6],radius:500});
const save=async(revision,before,value)=>{const r=await send({baseRevision:revision,changes:[{key:'yyz-zones',before:JSON.stringify(before),value:JSON.stringify(value)}]});return [r.status,await r.json()]};
let [status,state]=await save(0,[],[zone('A')]);assert.equal(status,200);
[status,state]=await save(0,[],[zone('B')]);assert.equal(status,409);assert.equal(state.revision,1);
[status,state]=await save(1,[],[zone('B')]);assert.equal(status,200);assert.deepEqual(JSON.parse(state.data['yyz-zones']).map(z=>z.id),['A','B']);
[status,state]=await save(2,[zone('A')],[]);assert.equal(status,200);assert.deepEqual(JSON.parse(state.data['yyz-zones']).map(z=>z.id),['B']);
assert.equal((await send({baseRevision:3,changes:[{key:'yyz-left-collapsed',before:null,value:'false'}]})).status,400);
console.log('Passed: private same-origin settings API, stale revisions rejected, concurrent zone additions merge, explicit deletion preserves other device additions, device layout excluded');
const page=fs.readFileSync('worker/page.html','utf8'),code=page.slice(page.indexOf('function createCloudSync()'),page.indexOf('syncController=createCloudSync()'));
function device(initial=[]){
 const storage=new Map(initial),button={textContent:'',dataset:{}},timers=new Map(),intervals=[];let next=0,offline=false;
 const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 const context=vm.createContext({console,Map,Set,JSON,AbortSignal,UI_SYNC_KEYS:new Set(['yyz-zones','yyz-watchlist']),localStorage,syncButton:button,undoRestoring:false,undoBaseline:null,document:{hidden:false,activeElement:null,addEventListener(){}},window:{addEventListener(){}},navigator:{onLine:true},setTimeout(fn){timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id),setInterval(fn,ms){intervals.push({fn,ms})},applySharedUi(){},appStorage:localStorage,fetch:async(url,options={})=>{if(offline)throw Error('offline');return send(options.body?JSON.parse(options.body):undefined)}});
 vm.runInContext(fs.readFileSync('worker/sync.js','utf8').split('async function uiStateApi')[0].replace('const UI_SYNC_KEYS','const SERVER_KEYS')+code+';globalThis.client=createCloudSync()',context);
 return {storage,context,button,intervals,poll(){return intervals[0].fn()},change(key,value){const before=localStorage.getItem(key);localStorage.setItem(key,value);context.client.changed(key,before,value)},start(){context.client.start()},sync(){return button.onclick()},offline(value){offline=value}};
}
const a=device(),b=device();a.start();await a.sync();await new Promise(r=>setTimeout(r,5));b.start();await new Promise(r=>setTimeout(r,5));
assert.equal(JSON.parse(a.storage.get('yyz-zones'))[0].id,'B');
a.change('yyz-zones',JSON.stringify([zone('B'),zone('C')]));b.change('yyz-zones',JSON.stringify([zone('B'),zone('D')]));await a.sync();await b.sync();await a.sync();assert.deepEqual(JSON.parse(a.storage.get('yyz-zones')).map(z=>z.id),['B','C','D']);
a.offline(true);a.change('yyz-watchlist','["C-TEST"]');await a.sync();assert.match(a.button.textContent,/Не синхронизировано/);assert.equal(JSON.parse(a.storage.get('yyz-sync-pending')).length,1);a.offline(false);await a.sync();await b.sync();assert.equal(b.storage.get('yyz-watchlist'),'["C-TEST"]');assert.equal(a.storage.get('yyz-sync-pending'),'[]');
console.log('Passed: two isolated device clients synchronize both directions, concurrent additions survive, failed delivery is journaled and retried successfully');

const migrated=device([['yyz-zones',JSON.stringify([zone('EXISTING')])]]);migrated.start();await new Promise(r=>setTimeout(r,10));await b.sync();assert.ok(JSON.parse(b.storage.get('yyz-zones')).some(z=>z.id==='EXISTING'));assert.ok(JSON.parse(b.storage.get('yyz-zones')).some(z=>z.id==='D'));console.log('Passed: first connection imports existing device zones without erasing cloud zones');

assert.equal(a.intervals[0].ms,1000);a.context.document.activeElement={matches:()=>true};b.change('yyz-watchlist','[\"C-TEST\",\"C-NEXT\"]');await b.sync();await a.poll();assert.equal(a.storage.get('yyz-watchlist'),'[\"C-TEST\",\"C-NEXT\"]');
// Clearing an older local list must also clear unseen entries from the server.
a.change('yyz-watchlist','[]');await a.sync();await b.poll();assert.equal(b.storage.get('yyz-watchlist'),'[]');assert.equal(a.storage.get('yyz-sync-pending'),'[]');console.log('Passed: one-second receiving continues with focused inputs; whole-list removal reaches the second device');

assert.equal(server.mergeUiValue('yyz-watchlist','[\"C-TEST\"]','[]','[\"C-TEST\",\"C-NEW\"]'),'[]');console.log('Passed: explicit clear also removes concurrent remote additions');
