import { buildSumopodChatRequest, parseOpenAITextStream, StreamFailure } from '../sumopod.ts';
import { ApiError } from '../http.ts';
import { limit } from '../rate-limit.ts';
import { getModelById } from '../ai-models.ts';
import { verifyFrontierAccessToken } from '../aet-frontier-access.ts';
import { gatewayErrorKind } from './gateway-errors.ts';
import { estimateInput, RequestBudget, type CallRole } from './budget.ts';
import type { ChatMode } from '../../types/index.ts';
import { assertGatewayReady, recordProviderFailure, recordProviderSuccess } from './provider-health.ts';

type GatewayMessage = { role: string; content: string | { type: string; text?: string; image_url?: {url: string} }[] };
type Gate = { active: number; waiting: (() => void)[] };
const shared = globalThis as typeof globalThis & { aetProviderGate?: Gate };
export async function acquireProvider(signal: AbortSignal): Promise<() => void> {
  const gate = shared.aetProviderGate ??= { active: 0, waiting: [] };
  const configured = Number(process.env.AET_PROVIDER_MAX_CONCURRENT || 4);
  const ceiling = Number.isInteger(configured) && configured >= 1 ? Math.min(16, configured) : 4;
  signal.throwIfAborted();
  if (gate.active >= ceiling || gate.waiting.length) await new Promise<void>((resolve, reject) => {
    const ready = () => { cleanup(); gate.active++; resolve(); };
    const abort = () => { const i = gate.waiting.indexOf(ready); if (i >= 0) gate.waiting.splice(i, 1); cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    gate.waiting.push(ready); signal.addEventListener('abort', abort, { once: true });
  }); else gate.active++;
  let released = false;
  return () => { if (released) return; released = true; gate.active--; gate.waiting.shift()?.(); };
}
export function assertModelAccess(modelId: string, frontierToken: unknown): void {
  const model = getModelById(modelId);
  if (!model || model.availability !== 'available' || model.supportsStreaming !== true) throw new ApiError(503, 'Kandidat model belum tersedia.', 'MODEL_UNAVAILABLE');
  if (model.isFrontier) {
    if (!verifyFrontierAccessToken(frontierToken)) throw new ApiError(403, 'Akses AET perlu diverifikasi.', 'FRONTIER_REQUIRED');
    if (process.env.ENABLE_FRONTIER !== 'true') throw new ApiError(503, 'Akses lanjutan belum diaktifkan.', 'FRONTIER_DISABLED');
    limit('frontier-provider:global', 20, 86_400_000);
  }
}
export class ProviderFailure extends ApiError {
  retryAfter: string | null;
  retryable: boolean;
  constructor(code: string, status = 502, retryable = false, retryAfter: string | null = null) {
    super(status, 'Respons penyedia gagal atau belum selesai. Silakan coba ulang.', code);
    this.retryable = retryable; this.retryAfter = retryAfter;
  }
}
export async function generateText(options: {
  role: CallRole; modelId: string; persona: ChatMode; system: string; messages: GatewayMessage[];
  outputLimit: number; budget: RequestBudget; frontierToken?: unknown; keepFinal?: boolean;
  fetcher?: typeof fetch; onDelta?: (text: string) => void;
  timeoutMs?: number;
  beforeFrontierAttempt?: () => void;
}): Promise<string> {
  const { budget, modelId } = options;
  const key = process.env.SUMOPOD_API_KEY;
  if (!key) throw new ApiError(503, 'Layanan AI belum dikonfigurasi pengelola.', 'AI_CONFIG');
  let outbound: ReturnType<typeof buildSumopodChatRequest>;
  try {outbound=buildSumopodChatRequest({ apiKey: key, baseUrl: process.env.SUMOPOD_BASE_URL, modelId, mode: options.persona,
    systemInstruction: options.system, messages: options.messages, maxTokens: options.outputLimit });}
  catch {throw new ApiError(503,'URL gateway server tidak valid.','GATEWAY_CONFIG');}
  const body = JSON.parse(outbound.init.body);
  const output = body.max_tokens ?? body.max_completion_tokens;
  // Images are charged a separate conservative token reserve; byte size of a
  // base64 image is not a useful vision-token count. Only historically tested
  // gpt-4o-mini input is allowed, <=4 images, at most 8192 reserved tokens each.
  const tokenMessages = body.messages.map((m: GatewayMessage) => ({ ...m, content: Array.isArray(m.content) ? m.content.map(p => p.type === 'image_url' ? {type:'image_url', tokenReserve:8192} : p) : m.content }));
  const images = options.messages.reduce((n,m) => n + (Array.isArray(m.content) ? m.content.filter(p => p.type === 'image_url').length : 0), 0);
  if (images && getModelById(modelId)?.supportsImageInput !== true) throw new ApiError(400,'Input gambar belum terverifikasi untuk kandidat ini.','IMAGE_UNSUPPORTED');
  if(images && budget.maxUsd!==null)throw new ApiError(503,'Batas USD untuk gambar memerlukan kalibrasi token gambar pada gateway.','VISION_PRICING_UNKNOWN');
  const input = estimateInput(tokenMessages) + images * 8192;
  if (input + output > Math.min(getModelById(modelId)?.contextCapacity ?? 32_000, 128_000)) throw new ApiError(413, 'Konteks beserta cadangan jawaban terlalu panjang.', 'CONTEXT_LIMIT');
  let tries = 0;
  while (true) {
    budget.check();
    const release = await acquireProvider(budget.signal);
    const callSignal = AbortSignal.any([budget.signal,AbortSignal.timeout(Math.max(1,Math.floor(options.timeoutMs ?? budget.remainingMs())))]);
    let record: ReturnType<RequestBudget['reserve']> | undefined;
    const start = Date.now(); let emitted = false;
    try {
      budget.check(); assertModelAccess(modelId, options.frontierToken);
      assertGatewayReady(modelId);
      if(getModelById(modelId)?.isFrontier)options.beforeFrontierAttempt?.();
      const perMinute = Number(process.env.AET_PROVIDER_CALLS_PER_MINUTE || 120);
      limit('provider:global:minute', Number.isInteger(perMinute) && perMinute > 0 ? perMinute : 120, 60_000);
      record = budget.reserve(options.role, modelId, input, output, options.keepFinal);
      let response: Response;
      try { response = await (options.fetcher ?? fetch)(outbound.url, { ...outbound.init, signal: callSignal, cache: 'no-store', redirect: 'error' }); }
      catch { budget.check(); if(callSignal.aborted)throw new ProviderFailure('UPSTREAM_TIMEOUT',504);throw new ProviderFailure('UPSTREAM_TRANSPORT', 502, true); }
      if (!response.ok) {
        const kind = gatewayErrorKind(response.status); const header = response.headers.get('retry-after');
        const retryAfter = header && (/^\d{1,6}$/.test(header) || Number.isFinite(Date.parse(header))) ? header : null;
        await response.body?.cancel();
        recordProviderFailure(modelId,response.status,retryAfter);
        throw new ProviderFailure(`UPSTREAM_${kind.toUpperCase()}`, response.status === 429 ? 429 : kind === 'billing' ? 503 : 502, response.status >= 500, retryAfter);
      }
      if (!response.headers.get('content-type')?.includes('text/event-stream')) { await response.body?.cancel(); throw new ProviderFailure('UPSTREAM_FORMAT'); }
      let text = '';
      for await (const delta of parseOpenAITextStream(response, { expectedModel: modelId, signal: callSignal, readUsageAfterStop: true, onMetadata: m => {
        if (m.model) record!.reportedModel = m.model;
        if (m.usage && Object.keys(m.usage).length) record!.usage = { ...record!.usage, ...m.usage };
      } })) {
        text += delta;
        if (text.length > 128_000) throw new ProviderFailure('UPSTREAM_FORMAT');
        if (options.onDelta) { emitted = true; options.onDelta(delta); }
      }
      budget.check();
      if(callSignal.aborted)throw new ProviderFailure('UPSTREAM_TIMEOUT',504);
      if (record.usage && ((record.usage.completion_tokens ?? 0) > output || (record.usage.prompt_tokens ?? 0) > input)) throw new ProviderFailure('UPSTREAM_USAGE_EXCEEDS_RESERVATION');
      const rate = budget.rates[modelId]; const u = record.usage;
      if (rate && u?.prompt_tokens !== undefined && u.completion_tokens !== undefined) record.usageBasedCostUsd = (u.prompt_tokens * rate.inputUsdPerMillion + u.completion_tokens * rate.outputUsdPerMillion) / 1e6;
      record.status = 'complete'; recordProviderSuccess(modelId); return text;
    } catch (error) {
      if (record) { record.status = 'failed'; record.errorCode = error instanceof ApiError ? error.code : error instanceof StreamFailure ? 'UPSTREAM_STREAM' : 'CANCELLED'; }
      budget.check();
      // No rotation to bypass shared billing/quota; retry the same model only
      // before publication, at most once, using the same global attempt budget.
      if (!emitted && error instanceof ProviderFailure && error.retryable && ++tries < 2 && budget.canReserve(input, output, options.keepFinal, modelId)) continue;
      throw error instanceof StreamFailure ? new ProviderFailure('UPSTREAM_STREAM') : error;
    } finally { if (record) {record.durationMs = Date.now() - start;const u=record.usage,rate=budget.rates[modelId];if(rate&&u?.prompt_tokens!==undefined&&u.completion_tokens!==undefined)record.usageBasedCostUsd=(u.prompt_tokens*rate.inputUsdPerMillion+u.completion_tokens*rate.outputUsdPerMillion)/1e6;} release(); }
  }
}
