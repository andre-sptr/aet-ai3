export type ChatStreamEvent = { event: string; data: Record<string, unknown> };
export async function* readChatEvents(response: Response, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  if(!response.body)throw new Error('Stream respons kosong.');
  const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',finished=false;
  function frame(value:string): ChatStreamEvent | undefined {
    const lines=value.split(/\r?\n/);const data=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
    if(!data)return;
    const event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim()||'message';
    try{const parsed=JSON.parse(data);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return{event,data:parsed};}catch{throw new Error('Format respons streaming tidak valid.');}
  }
  const cancel=()=>{void reader.cancel(signal?.reason).catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    signal?.throwIfAborted();
    while(true){
      const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;
      buffer+=decoder.decode(value,{stream:true});if(buffer.length>256_000)throw new Error('Respons streaming terlalu besar.');
      const frames=buffer.split(/\r?\n\r?\n/);buffer=frames.pop()||'';
      for(const value of frames){const parsed=frame(value);if(!parsed)continue;if(parsed.event==='error')throw new Error(String(parsed.data.message||'Respons gagal.'));if(parsed.event==='done')finished=true;yield parsed;if(finished)return;}
    }
    buffer+=decoder.decode();
    if(buffer.trim()){const parsed=frame(buffer);if(parsed){if(parsed.event==='error')throw new Error(String(parsed.data.message||'Respons gagal.'));if(parsed.event==='done')finished=true;yield parsed;}}
    if(!finished)throw new Error('Koneksi terputus sebelum respons selesai.');
  }finally{signal?.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
