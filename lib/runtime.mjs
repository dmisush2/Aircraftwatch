import {getStore} from '@netlify/blobs';
import {createBucket} from './bucket.mjs';
export function environment(){return {ADSB_RAPIDAPI_KEY:process.env.ADSB_RAPIDAPI_KEY,BUCKET:createBucket(getStore({name:process.env.CONTEXT==='production'?'aircraft-watch-v72':'aircraft-watch-v72-preview',consistency:'strong'}))}}
