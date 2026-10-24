import type { ResponseMode, ChatMode, ChatSource } from '../types/index.ts';
type EventData = {
  status: {requestId:string;stage:string;message:string};
  sources: {requestId:string;sources:ChatSource[]};
  meta: {requestId?:string;responseMode?:ResponseMode;persona?:ChatMode;requestedModel?:string;sources?:ChatSource[]};
  delta: {text:string;requestId?:string}; done: {requestId?:string;status?:'complete'};
  cancelled: {message:string;requestId?:string;code?:string};
  error: {message:string;requestId?:string;code?:string;retryAfter?:string|null};
};
export type ChatStreamEvent = {[K in keyof EventData]: {event:K;data:EventData[K] & Record<string,unknown>}}[keyof EventData];
function validateEvent(event: string, data: Record<string,unknown>): ChatStreamEvent {
  if (!['status','sources','meta','delta','done','cancelled','error'].includes(event)
    || event==='delta' && typeof data.text!=='string'
    || ['error','cancelled'].includes(event) && typeof data.message!=='string'
    || event==='sources' && !Array.isArray(data.sources)
    || event==='status' && (typeof data.message!=='string' || typeof data.stage!=='string' || typeof data.requestId!=='string')) throw new Error('Format respons streaming tidak valid.');
  return {event,data} as ChatStreamEvent;
}
export async function* readChatEvents(response: Response, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  if(!response.body)throw new Error('Stream respons kosong.');
  const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',finished=false;
  function frame(value:string): ChatStreamEvent | undefined {
    const lines=value.split(/\r?\n/);const data=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
    if(!data)return;
    const event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim()||'message';
    try{const parsed=JSON.parse(data);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return validateEvent(event,parsed);}catch{throw new Error('Format respons streaming tidak valid.');}
  }
  const cancel=()=>{void reader.cancel(signal?.reason).catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    signal?.throwIfAborted();
    while(true){
      const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;
      buffer+=decoder.decode(value,{stream:true});if(buffer.length>256_000)throw new Error('Respons streaming terlalu besar.');
      const frames=buffer.split(/\r?\n\r?\n/);buffer=frames.pop()||'';
      for(const value of frames){const parsed=frame(value);if(!parsed)continue;if(parsed.event==='error'||parsed.event==='cancelled')throw new Error(String(parsed.data.message||'Respons gagal.'));if(parsed.event==='done')finished=true;yield parsed;if(finished)return;}
    }
    buffer+=decoder.decode();
    if(buffer.trim()){const parsed=frame(buffer);if(parsed){if(parsed.event==='error'||parsed.event==='cancelled')throw new Error(String(parsed.data.message||'Respons gagal.'));if(parsed.event==='done')finished=true;yield parsed;}}
    if(!finished)throw new Error('Koneksi terputus sebelum respons selesai.');
  }finally{signal?.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
