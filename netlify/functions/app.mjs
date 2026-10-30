import app from '../../lib/generated-worker.mjs';
import {environment} from '../../lib/runtime.mjs';
import {authorize} from '../../lib/auth.mjs';
export default async function handler(request){
 const denied=authorize(request);if(denied)return denied;
 try{
  const url=new URL(request.url);url.pathname=url.pathname.replace(/^\/\.netlify\/functions\/app/,'')||'/';
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==url.origin)return new Response('Origin rejected',{status:403});
  if(url.pathname==='/api/monitor/tick')return new Response('Use the Netlify scheduled function for monitoring',{status:403});
  const forwarded=new Request(url,{method:request.method,headers:request.headers,...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{} )});
  const response=await app.fetch(forwarded,environment());
  const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
  return new Response(response.body,{status:response.status,headers});
 }catch(error){console.error('Aircraft Watch request failed',error.name);return Response.json({error:'Server error; check Netlify Functions logs'},{status:500})}
}
