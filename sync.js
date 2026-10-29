// Owner-private Site settings. Layout and viewport stay on each device.
const UI_SYNC_KEYS=new Set(['yyz-zones','yyz-watchlist','yyz-label-prefs','yyz-fleet-columns','yyz-selected-types','yyz-extra-types','yyz-query-mode','yyz-area-radius','yyz-hold-seconds','yyz-vector-meters','yyz-vector-mode','yyz-event-sounds','yyz-sound-enabled','yyz-aircraft-display','yyz-label-layout','yyz-zone-boards','yyz-fleet-sort','yyz-refresh-interval']);
function mergeUiValue(key,before,value,current){
 if(key==='yyz-zones'){
  const old=JSON.parse(before||'[]'),next=JSON.parse(value),latest=JSON.parse(current||'[]');
  if(!Array.isArray(old)||!Array.isArray(next)||!Array.isArray(latest)||next.length>200||next.some(z=>!z||!['string','number'].includes(typeof z.id)))throw Error('Некорректные зоны');
  const oldMap=new Map(old.map(z=>[String(z.id),z])),newMap=new Map(next.map(z=>[String(z.id),z]));
  const removed=new Set([...oldMap.keys()].filter(id=>!newMap.has(id)));
  const merged=new Map(latest.filter(z=>!removed.has(String(z.id))).map(z=>[String(z.id),z]));
  for(const [id,z] of newMap)if(JSON.stringify(z)!==JSON.stringify(oldMap.get(id)))merged.set(id,z);
  if(merged.size>200)throw Error('Не больше 200 зон');
  return JSON.stringify([...merged.values()]);
 }
 if(key==='yyz-watchlist'){
  const old=JSON.parse(before||'[]'),next=JSON.parse(value),latest=JSON.parse(current||'[]');
  if(![old,next,latest].every(Array.isArray)||next.some(r=>typeof r!=='string'||!/^[A-Z0-9-]{2,12}$/.test(r)))throw Error('Некорректный список');
  if(next.length===0)return '[]';
  const result=new Set(latest),added=next.filter(r=>!old.includes(r));old.filter(r=>!next.includes(r)).forEach(r=>result.delete(r));added.forEach(r=>result.add(r));if(result.size>100)throw Error('Не больше 100 регистраций');return JSON.stringify([...result]);
 }
 return value;
}
async function uiStateApi(request,env){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 if(!env.BUCKET)return reply({error:'Хранилище недоступно'},503);
 if(request.method!=='GET'&&request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Origin rejected'},403);
 try{
  const stored=await env.BUCKET.get('ui/settings-v1.json');const state=stored?JSON.parse(await stored.text()):{revision:0,data:{},updatedAt:null};
  if(request.method==='GET')return reply(state);
  const raw=await request.text();if(raw.length>400000)return reply({error:'Слишком много данных'},413);
  const body=JSON.parse(raw);if(body.baseRevision!==state.revision)return reply(state,409);
  if(!Array.isArray(body.changes)||body.changes.length>UI_SYNC_KEYS.size)return reply({error:'Некорректные изменения'},400);
  const data={...state.data};
  for(const change of body.changes){if(!UI_SYNC_KEYS.has(change.key)||typeof change.value!=='string'||change.value.length>150000||!(change.before===null||typeof change.before==='string')||(change.before?.length||0)>150000)throw Error('Некорректные настройки');data[change.key]=mergeUiValue(change.key,change.before,change.value,data[change.key]);}
  const next={revision:state.revision+1,data,updatedAt:new Date().toISOString()};const serialized=JSON.stringify(next);if(serialized.length>300000)return reply({error:'Слишком много данных'},413);
  const saved=await env.BUCKET.put('ui/settings-v1.json',serialized,{onlyIf:stored?{etagMatches:stored.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(!saved){const latest=await env.BUCKET.get('ui/settings-v1.json');return reply(latest?JSON.parse(await latest.text()):state,409)}
  return reply(next);
 }catch(error){return reply({error:error.message||'Ошибка синхронизации'},400)}
}
