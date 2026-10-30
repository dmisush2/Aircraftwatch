import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync('worker/page.html','utf8');const source=html.slice(html.indexOf('async function refresh()'),html.indexOf('function stop()'));
const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:'5',textContent:'',disabled:false,replaceChildren(){},append(){}});return elements.get(id)};let calls=0,fail=false;
const c={$,AbortSignal,Date,Number,Set,JSON,fetch:async()=>{calls++;if(fail)throw Error('Temporary network error');return {ok:true,json:async()=>({queries:1,results:[]})}},stop:()=>{throw Error('Unexpected automatic stop')},estimate(){},renderPlanes(){},renderZoneBoards(){},renderFleet(){},setupForm(){},displayRefreshPending:false,aircraftDisplayMode:'watched',queryMode:'area',registrations:[],sessionQueries:1000,busy:false,listRevision:0,aircraft:[],timer:42};vm.createContext(c);vm.runInContext(source,c);
await c.refresh();assert.equal(calls,1);assert.equal(c.sessionQueries,1001);assert.equal(c.timer,42);
fail=true;await c.refresh();assert.equal(c.busy,false);assert.equal(c.timer,42);assert.match($('apiStatus').textContent,/повторим запрос/);
fail=false;await c.refresh();assert.equal(calls,3);assert.equal(c.sessionQueries,1002);assert.equal(c.timer,42);
console.log('Passed: polling beyond 300 queries; network error preserves running state; next request recovers');

fail=false;c.queryMode='individual';c.aircraftDisplayMode='all';await c.refresh();assert.equal(calls,4);assert.equal(c.timer,42);
