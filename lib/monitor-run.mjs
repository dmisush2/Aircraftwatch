import app from './generated-worker.mjs';
// Independent scheduler: does not modify or call the existing Ramp Schedule bot bridge.
export async function runMonitor(env,{token,chatId,fetcher=fetch,worker=app}={}){
 if(!token||!chatId)return {skipped:'Telegram credentials not configured'};
 const now=Date.now();const key='netlify/scheduler-lock.json';const old=await env.BUCKET.get(key);
 if(old&&now-(await old.json()).at<110000)return {busy:true};
 const lock=await env.BUCKET.put(key,JSON.stringify({at:now}),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'}});if(!lock)return {busy:true};
 try{
  const response=await worker.fetch(new Request('https://aircraft-watch.internal/api/monitor/tick',{method:'POST'}),env);const result=await response.json();
  if(!response.ok)throw Error('Monitor tick failed: '+(result.error||response.status));
  let sent=0;
  for(const event of result.events||[]){
   if(Date.now()-now>18000)break;
   const receipt='netlify/telegram-receipts/'+event.id;if(await env.BUCKET.get(receipt))continue;
   const delivered=await fetcher('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:event.text}),signal:AbortSignal.timeout(8000)});
   const body=await delivered.json();if(!delivered.ok||!body.ok)throw Error('Telegram delivery failed');
   await env.BUCKET.put(receipt,JSON.stringify({at:Date.now()}));sent++;
  }
  return {sent,queries:result.queries||0};
 }finally{await env.BUCKET.delete(key)}
}
