import {timingSafeEqual} from 'node:crypto';
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export function authorize(request,env=process.env){
 if(!env.APP_USERNAME||!env.APP_PASSWORD)return new Response('Set APP_USERNAME and APP_PASSWORD in Netlify environment variables, then redeploy.',{status:503,headers:{'Cache-Control':'no-store'}});
 let supplied='';try{const h=request.headers.get('authorization')||'';if(h.startsWith('Basic '))supplied=Buffer.from(h.slice(6),'base64').toString('utf8')}catch{}
 if(!equal(supplied,env.APP_USERNAME+':'+env.APP_PASSWORD))return new Response('Sign in to Aircraft Watch',{status:401,headers:{'WWW-Authenticate':'Basic realm="Aircraft Watch", charset="UTF-8"','Cache-Control':'no-store'}});
 return null;
}
