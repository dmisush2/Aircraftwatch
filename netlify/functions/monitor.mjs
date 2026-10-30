import {environment} from '../../lib/runtime.mjs';
import {runMonitor} from '../../lib/monitor-run.mjs';
export default async()=>{
 if(process.env.CONTEXT!=='production'||process.env.MONITOR_ENABLED!=='true')return;
 if(!process.env.ADSB_RAPIDAPI_KEY)return;
 const result=await runMonitor(environment(),{token:process.env.TELEGRAM_BOT_TOKEN,chatId:process.env.TELEGRAM_CHAT_ID});
 console.log('Monitor',JSON.stringify(result));
};
export const config={schedule:'* * * * *'};
