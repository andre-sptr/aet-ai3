import { buildSumopodChatRequest, DEFAULT_SUMOPOD_MODEL, parseOpenAITextStream } from '@/lib/sumopod';
import { getModelById } from '@/lib/ai-models';
import { verifyFrontierAccessToken } from '@/lib/aet-frontier-access';
import { ApiError, errorResponse, readJson, sameOrigin } from '@/lib/http';
import { clientKey, limit } from '@/lib/rate-limit';
import { validateChat, selectContext } from '@/lib/ai/context';
import { prepareMessages } from '@/lib/ai/message-context';
import { buildSystemPrompt } from '@/lib/ai/personas/prompt-builder';
import { runTools } from '@/lib/ai/tools';
import { retrieveAetKnowledge } from '@/lib/ai/knowledge';
import { evidenceSources } from '@/lib/ai/evidence';
import { citationPolicyResponse } from '@/lib/ai/citation-policy';
export const runtime = 'nodejs';
const state = globalThis as typeof globalThis & { aetChatActive?: number };
export async function POST(request: Request) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(new Error('Chat timeout')), 60_000);
  let acquired = false, transferred = false;
  const release = () => { clearTimeout(timer); if(acquired) { state.aetChatActive = Math.max(0,(state.aetChatActive || 1)-1); acquired=false; } };
  try {
    sameOrigin(request);
    limit(`chat:${clientKey(request)}`,12,60_000);
    limit('chat:global:hour',Number(process.env.CHAT_HOURLY_LIMIT || 100),3600_000);
    if((state.aetChatActive || 0)>=4)throw new ApiError(429,'Server sedang memproses beberapa percakapan. Coba lagi sebentar.');
    state.aetChatActive=(state.aetChatActive||0)+1;acquired=true;
    const body=await readJson(request,8*1024*1024);
    const parsed=validateChat(body);
    const modelId=parsed.model || DEFAULT_SUMOPOD_MODEL;
    const model=getModelById(modelId);
    if(!model)throw new ApiError(400,'Model ini sudah tidak tersedia. Pilih model aktif untuk melanjutkan.', 'MODEL_RETIRED');
    if(model.availability!=='available')throw new ApiError(503,'Model belum terverifikasi atau sedang tidak tersedia. Pilih model lain.', 'MODEL_UNAVAILABLE');
    if(model.isFrontier) {
      if(!verifyFrontierAccessToken(parsed.frontierAccessToken))throw new ApiError(403,'Model Frontier memerlukan verifikasi AET.', 'FRONTIER_REQUIRED');
      if(process.env.ENABLE_FRONTIER!=='true')throw new ApiError(503,'Model Frontier belum diaktifkan pengelola.', 'FRONTIER_DISABLED');
      limit(`frontier-chat:${clientKey(request)}`,8,86400_000);
      limit('frontier-chat:global',20,86400_000);
    }
    const context=selectContext(parsed.messages);
    const last=context.messages.at(-1)!;
    const finalContext=await prepareMessages(context.messages,model.supportsImageInput===true);
    const contextTruncated=context.truncated || finalContext.truncated;
    const apiMessages=finalContext.messages;
    const signal=AbortSignal.any([request.signal,abort.signal]);
    signal.throwIfAborted();
    const toolResult=await runTools(last.content,signal);
    const previous=context.messages.filter(m=>m.role==='user').slice(-3,-1).map(m=>m.content).join('\n');
    const knowledge=await retrieveAetKnowledge(last.content,previous);
    const evidence=[...knowledge,...toolResult.evidence];
    const system=buildSystemPrompt(parsed.mode,last.content,evidence,new Date(),{imageInput:model.supportsImageInput===true});
    const useEvents=request.headers.get('accept')?.includes('text/event-stream');
    let iterator: AsyncGenerator<string>;
    const directResponse=toolResult.directResponse || citationPolicyResponse(last.content);
    if(directResponse) {
      const direct=directResponse;
      iterator=(async function*(){yield direct;})();
    } else {
      const key=process.env.SUMOPOD_API_KEY;
      if(!key)throw new ApiError(503,'Layanan AI belum dikonfigurasi pengelola.', 'AI_CONFIG');
      const outbound=buildSumopodChatRequest({apiKey:key,baseUrl:process.env.SUMOPOD_BASE_URL,modelId,mode:parsed.mode,systemInstruction:system,messages:apiMessages,inputText:last.content});
      let upstream: Response;
      try { upstream=await fetch(outbound.url,{...outbound.init,signal:AbortSignal.any([request.signal,abort.signal]),cache:'no-store'}); }
      catch { throw new ApiError(504,'Tidak dapat menghubungi model dalam batas waktu. Silakan coba lagi.', 'UPSTREAM_TIMEOUT'); }
      if(!upstream.ok) {
        await upstream.body?.cancel();
        throw new ApiError(upstream.status===429?429:502,upstream.status===429?'Batas penggunaan penyedia tercapai. Coba lagi nanti.':'Penyedia menolak permintaan. Coba model lain atau hubungi pengelola.', 'UPSTREAM_ERROR');
      }
      if(!upstream.headers.get('content-type')?.includes('text/event-stream')) { await upstream.body?.cancel(); throw new ApiError(502,'Format streaming penyedia tidak sesuai.', 'UPSTREAM_FORMAT'); }
      iterator=parseOpenAITextStream(upstream);
    }
    const encoder=new TextEncoder();
    let cancelled=false;
    const stream=new ReadableStream<Uint8Array>({
      async start(controller) {
        const event=(type:string,data:unknown)=>{if(!cancelled)controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));};
        try {
          if(useEvents)event('meta',{model:modelId,contextTruncated,sources:evidenceSources(evidence)});
          for await(const delta of iterator) {
            if(cancelled || request.signal.aborted || abort.signal.aborted)throw new Error('Response cancelled.');
            if(useEvents)event('delta',{text:delta});else controller.enqueue(encoder.encode(delta));
          }
          if(useEvents)event('done',{});
          if(!cancelled)controller.close();
        }catch{
          if(!cancelled) {
            if(useEvents){event('error',{message:'Respons terputus atau belum selesai. Coba ulang; jawaban parsial tidak dipakai sebagai konteks.'});controller.close();}
            else controller.error(new Error('Respons terputus.'));
          }
        }finally{abort.abort();release();}
      },
      cancel(){cancelled=true;abort.abort();void iterator.return(undefined);release();},
    });
    transferred=true;
    return new Response(stream,{headers:{'Content-Type':useEvents?'text/event-stream; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','X-AET-Model':modelId,'X-AET-Context-Truncated':String(contextTruncated)}});
  }catch(error){return errorResponse(error);}
  finally{if(!transferred){abort.abort();release();}}
}
