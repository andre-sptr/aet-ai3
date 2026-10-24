import { createHash } from 'node:crypto';
import { ApiError } from '../http.ts';
type Health = { failures: number; until: number };
type GatewayState = { models: Map<string,Health>; shared?: {until:number;code:string;status:number} };
const root=globalThis as typeof globalThis & {aetGatewayHealth?:Map<string,GatewayState>};
function state(): GatewayState {
  const states=root.aetGatewayHealth??=new Map();
  const identity=createHash('sha256').update(`${process.env.SUMOPOD_BASE_URL ?? ''}:${process.env.SUMOPOD_API_KEY ?? ''}`).digest('hex');
  if(!states.has(identity)){if(states.size>32)states.delete(states.keys().next().value!);states.set(identity,{models:new Map()});}
  return states.get(identity)!;
}
export function unhealthyModels(now=Date.now()): string[] {return [...state().models].filter(([,v])=>v.until>now).map(([id])=>id);}
export function assertGatewayReady(model:string,now=Date.now()):void {
  const current=state();
  if(current.shared && current.shared.until>now){const e=new ApiError(current.shared.status,'Penyedia sedang membatasi layanan. Coba kembali setelah jeda.',current.shared.code) as ApiError & {retryAfter?:string};e.retryAfter=String(Math.ceil((current.shared.until-now)/1000));throw e;}
  if((current.models.get(model)?.until ?? 0)>now)throw new ApiError(503,'Kandidat model sedang dalam jeda setelah kegagalan penyedia.','MODEL_COOLDOWN');
}
export function recordProviderFailure(model:string,status:number,retryAfter:string|null,now=Date.now()):void {
  const current=state();
  if([401,402,403,429].includes(status)){
    const seconds=retryAfter?(/^\d+$/.test(retryAfter)?Number(retryAfter):(Date.parse(retryAfter)-now)/1000):60;
    const wait=Number.isFinite(seconds)?Math.max(1,Math.min(86400,seconds)):60;
    current.shared={until:now+wait*1000,status:status===429?429:503,code:status===429?'UPSTREAM_RATE_LIMIT':status===402?'UPSTREAM_BILLING':status===401?'UPSTREAM_AUTHENTICATION':'UPSTREAM_PERMISSION'};
  }else if(status>=500){const previous=current.models.get(model);const failures=(previous?.failures ?? 0)+1;current.models.set(model,{failures,until:failures>=2?now+30_000:0});}
}
export function recordProviderSuccess(model:string):void {state().models.delete(model);}
/** Test-only in-process reset. No route exposes this operation. */
export function resetProviderHealth():void {root.aetGatewayHealth?.clear();}
