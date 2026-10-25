import { getGenerationConfig } from './ai/model-config.ts';
import type { ChatMode } from '../types/index.ts';
export const DEFAULT_SUMOPOD_BASE_URL = 'https://ai.sumopod.com/v1';
export const DEFAULT_SUMOPOD_MODEL = 'gpt-4o-mini';
// Verified on this gateway by live operator probes on 25 October 2026.
// Keep optional usage metadata scoped to the three tested model IDs.
const VERIFIED_STREAM_USAGE_MODELS = new Set(['gpt-4o-mini', 'gpt-5.4-mini', 'deepseek-v4-flash']);
type Part = { type: string; text?: string; image_url?: { url: string } };
type AppMessage = { role: string; content: string | Part[] };
export type SumopodMessage = { role: 'system' | 'user' | 'assistant'; content: string | Part[] };
export function toSumopodMessages(systemInstruction: string, messages: AppMessage[]): SumopodMessage[] {
  return [{ role: 'system', content: systemInstruction }, ...messages.map(message => {
    if (!['user', 'assistant', 'model'].includes(message.role)) throw new Error('Invalid message role.');
    const role = message.role === 'user' ? 'user' as const : 'assistant' as const;
    return { role, content: message.content };
  })];
}
export function buildSumopodChatRequest({ apiKey, baseUrl = DEFAULT_SUMOPOD_BASE_URL, modelId = DEFAULT_SUMOPOD_MODEL, systemInstruction, messages, mode = 'daily', maxTokens, stream = true, inputText }: {
  apiKey: string; baseUrl?: string; modelId?: string; systemInstruction: string; messages: AppMessage[]; mode?: ChatMode; maxTokens?: number; stream?: boolean; inputText?: string;
}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/chat/completions`);
  if (url.username || url.password || (url.protocol !== 'https:' && !(process.env.AET_ALLOW_LOCAL_TEST_GATEWAY === 'true' && url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname)))) throw new Error('Invalid gateway URL.');
  const last = messages.filter(m => m.role === 'user').at(-1)?.content;
  const requestUsage = stream && url.href === `${DEFAULT_SUMOPOD_BASE_URL}/chat/completions` && VERIFIED_STREAM_USAGE_MODELS.has(modelId);
  return { url: url.href, init: { method: 'POST' as const, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: modelId, messages: toSumopodMessages(systemInstruction, messages), ...getGenerationConfig(modelId, mode, inputText ?? (typeof last === 'string' ? last : ''), maxTokens), stream, ...(requestUsage ? { stream_options: { include_usage: true } } : {}) }) } };
}
export type StreamFailureCode = 'STREAM_TRUNCATED' | 'STREAM_FILTERED' | 'STREAM_MALFORMED' | 'STREAM_MODEL_MISMATCH'
  | 'STREAM_DISCONNECTED' | 'STREAM_EMPTY' | 'STREAM_FINISH' | 'STREAM_LIMIT' | 'STREAM_PROVIDER_ERROR';
export class StreamFailure extends Error {
  readonly code: StreamFailureCode;
  constructor(message: string, code: StreamFailureCode = 'STREAM_MALFORMED') { super(message); this.name = 'StreamFailure'; this.code = code; }
}
export type DrainOutcome = 'done' | 'eof' | 'time_limit' | 'byte_limit' | 'aborted' | 'invalid_trailer' | 'not_requested';
export type StreamMetadata = {
  model?: string;
  finishReason?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  transportDone?: boolean;
  drainOutcome?: DrainOutcome;
};
export type StreamOptions = {
  expectedModel?: string;
  signal?: AbortSignal;
  onMetadata?: (metadata: StreamMetadata) => void;
  readUsageAfterStop?: boolean;
  /** Applies after stop AND terminal failures. Cannot extend the caller deadline. */
  metadataDrainMs?: number;
  metadataDrainBytes?: number;
};
export async function* parseOpenAITextStream(response: Response, options: StreamOptions = {}): AsyncGenerator<string> {
  if (!response.body) throw new StreamFailure('Empty upstream stream.', 'STREAM_EMPTY');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', stopped = false, transportDone = false, visible = false;
  let failure: StreamFailure | undefined, terminalAt: number | undefined, trailerBytes = 0;
  let drainOutcome: DrainOutcome | undefined;
  const drainMs = Math.max(0, Math.min(1_000, options.metadataDrainMs ?? 500));
  const drainBytes = Math.max(0, Math.min(65_536, options.metadataDrainBytes ?? 65_536));
  const terminal = () => stopped || Boolean(failure);
  const cancel = () => { void reader.cancel(options.signal?.reason).catch(() => {}); };
  options.signal?.addEventListener('abort', cancel, { once: true });
  function parse(frame: string): string[] {
    options.signal?.throwIfAborted();
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return [];
    if (data.trim() === '[DONE]') { transportDone = true; options.onMetadata?.({ transportDone: true }); return []; }
    let p;
    try { p = JSON.parse(data); } catch { throw new StreamFailure('Malformed upstream frame.'); }
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new StreamFailure('Malformed upstream frame.');
    if (p.error || /^event:\s*error/im.test(frame)) throw new StreamFailure('Upstream stream failed.', 'STREAM_PROVIDER_ERROR');
    if (p.model !== undefined) {
      if (typeof p.model !== 'string') throw new StreamFailure('Invalid upstream model identity.', 'STREAM_MODEL_MISMATCH');
      if (options.expectedModel && p.model !== options.expectedModel) throw new StreamFailure('Identitas model penyedia berbeda dari model yang diminta.', 'STREAM_MODEL_MISMATCH');
    }
    const wasStopped = terminal();
    if (p.choices !== undefined && (!Array.isArray(p.choices) || p.choices.length > 1)) throw new StreamFailure('Invalid upstream choices.');
    const choice = p.choices?.[0];
    const finish = choice?.finish_reason;
    const usage = p.usage && typeof p.usage === 'object'
      ? Object.fromEntries(['prompt_tokens', 'completion_tokens', 'total_tokens'].filter(k => Number.isSafeInteger(p.usage[k]) && p.usage[k] >= 0).map(k => [k, p.usage[k]]))
      : undefined;
    const content = choice?.delta?.content;
    // Trailers may carry metadata only; never publish additional answer text or
    // overwrite the first terminal finish reason with a later stop.
    if (wasStopped && (finish != null || typeof content === 'string' && content)) throw new StreamFailure('Unexpected text or finish after upstream completion.');
    options.onMetadata?.({ model: p.model, finishReason: typeof finish === 'string' ? finish : undefined, usage });
    if (finish === 'length') failure = new StreamFailure('Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan.', 'STREAM_TRUNCATED');
    else if (finish === 'content_filter') failure = new StreamFailure('Respons dihentikan oleh penyedia.', 'STREAM_FILTERED');
    else if (finish != null && finish !== 'stop') failure = new StreamFailure('Respons model belum selesai sebagai jawaban teks.', 'STREAM_FINISH');
    if (finish === 'stop') stopped = true;
    if (terminal() && terminalAt === undefined) terminalAt = Date.now();
    // Partial length output is retained by callers for diagnostics, but the
    // generator always throws its original failure after the bounded drain.
    if (typeof content === 'string' && content && !wasStopped) { visible ||= Boolean(content.trim()); return [content]; }
    return [];
  }
  try {
    options.signal?.throwIfAborted();
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = Symbol('metadata timeout');
      const remaining = terminalAt === undefined ? Infinity : drainMs - (Date.now() - terminalAt);
      if (terminal() && remaining <= 0) { drainOutcome = 'time_limit'; break; }
      const result = await (terminal() ? Promise.race([
        reader.read(), new Promise<typeof timeout>(resolve => { timer = setTimeout(() => resolve(timeout), remaining); }),
      ]).finally(() => clearTimeout(timer)) : reader.read());
      if (result === timeout) { drainOutcome = 'time_limit'; break; }
      const { done, value } = result;
      options.signal?.throwIfAborted();
      if (done) { drainOutcome = 'eof'; break; }
      if (terminal()) {
        trailerBytes += value.byteLength;
        if (trailerBytes > drainBytes) { drainOutcome = 'byte_limit'; break; }
      }
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 256_000) throw new StreamFailure('Upstream frame exceeds limit.', 'STREAM_LIMIT');
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        if (terminal()) {
          if (Date.now() - terminalAt! >= drainMs) { drainOutcome = 'time_limit'; break; }
          // Bound frames already buffered in the same network chunk as finish.
          // Separate chunks are also counted above; conservative double counting
          // is intentional and never changes a failure into success.
          trailerBytes += new TextEncoder().encode(frame).byteLength;
          if (trailerBytes > drainBytes) { drainOutcome = 'byte_limit'; break; }
        }
        for (const value of parse(frame)) yield value;
        if (transportDone || terminal() && !options.readUsageAfterStop) break;
      }
      if (transportDone) { drainOutcome = 'done'; break; }
      if (terminal() && !options.readUsageAfterStop) { drainOutcome = 'not_requested'; break; }
      if (drainOutcome === 'time_limit' || drainOutcome === 'byte_limit') break;
      if (terminal() && new TextEncoder().encode(buffer).byteLength > drainBytes) { drainOutcome = 'byte_limit'; break; }
    }
    buffer += decoder.decode();
    if (drainOutcome === 'eof' && (!terminal() || options.readUsageAfterStop) && !transportDone && buffer.trim()) for (const value of parse(buffer)) yield value;
    if (failure) throw failure;
    if (!stopped) throw new StreamFailure('Koneksi model terputus sebelum finish_reason=stop.', 'STREAM_DISCONNECTED');
    if (!visible) throw new StreamFailure('Model tidak mengirim jawaban teks.', 'STREAM_EMPTY');
  } catch (error) {
    if (failure) {
      if (error !== failure) drainOutcome = options.signal?.aborted ? 'aborted' : 'invalid_trailer';
      throw failure;
    }
    throw error;
  } finally {
    if (drainOutcome) options.onMetadata?.({ drainOutcome });
    options.signal?.removeEventListener('abort', cancel);
    // A hostile/failed underlying cancel promise must not extend the deadline.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
