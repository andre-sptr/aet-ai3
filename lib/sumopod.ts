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
  const requestUsage = stream && url.origin === 'https://ai.sumopod.com' && VERIFIED_STREAM_USAGE_MODELS.has(modelId);
  return { url: url.href, init: { method: 'POST' as const, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: modelId, messages: toSumopodMessages(systemInstruction, messages), ...getGenerationConfig(modelId, mode, inputText ?? (typeof last === 'string' ? last : ''), maxTokens), stream, ...(requestUsage ? { stream_options: { include_usage: true } } : {}) }) } };
}
export class StreamFailure extends Error { }
export type StreamMetadata = {
  model?: string;
  finishReason?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  transportDone?: boolean;
};
export type StreamOptions = {
  expectedModel?: string;
  signal?: AbortSignal;
  onMetadata?: (metadata: StreamMetadata) => void;
  readUsageAfterStop?: boolean;
};
export async function* parseOpenAITextStream(response: Response, options: StreamOptions = {}): AsyncGenerator<string> {
  if (!response.body) throw new StreamFailure('Empty upstream stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', stopped = false, transportDone = false, visible = false;
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
    if (p.error || /^event:\s*error/im.test(frame)) throw new StreamFailure('Upstream stream failed.');
    if (p.model !== undefined) {
      if (typeof p.model !== 'string') throw new StreamFailure('Invalid upstream model identity.');
      if (options.expectedModel && p.model !== options.expectedModel) throw new StreamFailure('Identitas model penyedia berbeda dari model yang diminta.');
    }
    const wasStopped = stopped;
    const choice = p.choices?.[0];
    const finish = choice?.finish_reason;
    const usage = p.usage && typeof p.usage === 'object'
      ? Object.fromEntries(['prompt_tokens', 'completion_tokens', 'total_tokens'].filter(k => Number.isFinite(p.usage[k]) && p.usage[k] >= 0).map(k => [k, p.usage[k]]))
      : undefined;
    options.onMetadata?.({ model: p.model, finishReason: typeof finish === 'string' ? finish : undefined, usage });
    if (finish === 'length') throw new StreamFailure('Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan.');
    if (finish === 'content_filter') throw new StreamFailure('Respons dihentikan oleh penyedia.');
    if (finish != null && finish !== 'stop') throw new StreamFailure('Respons model belum selesai sebagai jawaban teks.');
    if (finish === 'stop') stopped = true;
    const content = choice?.delta?.content;
    if (wasStopped && typeof content === 'string' && content) throw new StreamFailure('Unexpected text after upstream completion.');
    if (typeof content === 'string' && content) { visible ||= Boolean(content.trim()); return [content]; }
    return [];
  }
  try {
    options.signal?.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      options.signal?.throwIfAborted();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 256_000) throw new StreamFailure('Upstream frame exceeds limit.');
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        for (const value of parse(frame)) yield value;
        if (transportDone || stopped && !options.readUsageAfterStop) break;
      }
      if (transportDone || stopped && !options.readUsageAfterStop) break;
    }
    buffer += decoder.decode();
    if ((!stopped || options.readUsageAfterStop) && !transportDone && buffer.trim()) for (const value of parse(buffer)) yield value;
    if (!stopped) throw new StreamFailure('Koneksi model terputus sebelum finish_reason=stop.');
    if (!visible) throw new StreamFailure('Model tidak mengirim jawaban teks.');
  } finally {
    options.signal?.removeEventListener('abort', cancel);
    try { await reader.cancel(); } catch { /* already cancelled */ }
    reader.releaseLock();
  }
}
