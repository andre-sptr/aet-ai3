import { ApiError, errorResponse, readJson, sameOrigin } from '@/lib/http';
import { clientKey, limit } from '@/lib/rate-limit';
import { validateChat } from '@/lib/ai/context';
import { createOrchestrator } from '@/lib/ai/orchestration';

export const runtime = 'nodejs';
// Host configuration still determines the actual execution window. The mode
// deadlines fit below this declared ceiling; raising a JS timeout cannot raise it.
export const maxDuration = 60;
const state = globalThis as typeof globalThis & { aetChatActive?: number };
export async function POST(request: Request) {
  const abort = new AbortController();
  let acquired = false, transferred = false;
  const release = () => { if (acquired) { state.aetChatActive = Math.max(0,(state.aetChatActive || 1)-1); acquired = false; } };
  try {
    sameOrigin(request);
    limit(`chat:${clientKey(request)}`,12,60_000);
    limit('chat:global:hour',Number(process.env.CHAT_HOURLY_LIMIT || 100),3_600_000);
    if ((state.aetChatActive || 0) >= 4) throw new ApiError(429,'Server sedang memproses beberapa percakapan. Coba lagi sebentar.');
    state.aetChatActive = (state.aetChatActive || 0)+1; acquired = true;
    const parsed = validateChat(await readJson(request,8*1024*1024));
    const signal = AbortSignal.any([request.signal,abort.signal]);
    signal.throwIfAborted();
    const session = await createOrchestrator(parsed,{signal,beforeFrontierAttempt:()=>limit(`frontier-provider:${clientKey(request)}`,8,86_400_000)});
    const useEvents = request.headers.get('accept')?.includes('text/event-stream');
    const encoder = new TextEncoder(); let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const event = (type: string, data: unknown) => { if (!cancelled) controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)); };
        const heartbeat = useEvents ? setInterval(()=>{if(!cancelled)controller.enqueue(encoder.encode(': keep-alive\n\n'));},10_000) : undefined;
        try {
          const result = await session.run(e => { if(useEvents)event(e.event,e.data);else if(e.event==='delta'&&!cancelled)controller.enqueue(encoder.encode(e.data.text)); });
          signal.throwIfAborted();
          if(useEvents)event('done',{requestId:session.requestId,status:'complete',contextRevision:result.state.revision});
          if(!cancelled)controller.close();
        } catch(error) {
          if(!cancelled) {
            const stopped = signal.aborted;
            const timedOut = !stopped && session.budget.signal.aborted;
            if(useEvents) {
              event(stopped?'cancelled':'error',{requestId:session.requestId,message:stopped?'Permintaan dibatalkan. Jawaban belum selesai.':timedOut?'Batas waktu pemrosesan tercapai. Coba ulang.':error instanceof ApiError?error.message:'Respons terputus atau belum selesai. Coba ulang; jawaban parsial tidak dipakai sebagai konteks.',
                code:stopped?'CANCELLED':timedOut?'DEADLINE':error instanceof ApiError?error.code:'ORCHESTRATION_FAILED',retryAfter:(error as {retryAfter?:string})?.retryAfter ?? null});
              controller.close();
            } else controller.error(new Error('Respons terputus atau belum selesai.'));
          }
        } finally {clearInterval(heartbeat);abort.abort();release();}
      },
      cancel(){cancelled=true;abort.abort();release();},
    });
    transferred = true;
    return new Response(stream,{headers:{'Content-Type':useEvents?'text/event-stream; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no',
      'X-AET-Request-ID':session.requestId,'X-AET-Response-Mode':parsed.responseMode,'X-AET-Model':session.routing.modelId ?? 'none','X-AET-Routing-Reason':session.routing.reason}});
  } catch(error) {return errorResponse(error);}
  finally {if(!transferred){abort.abort();release();}}
}
