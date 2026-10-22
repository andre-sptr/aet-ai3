import { getGenerationConfig } from './ai/model-config.ts';
import type { ChatMode } from '../types/index.ts';
export const DEFAULT_SUMOPOD_BASE_URL = 'https://ai.sumopod.com/v1';
export const DEFAULT_SUMOPOD_MODEL = 'gpt-4o-mini';
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
  return { url: url.href, init: { method: 'POST' as const, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: modelId, messages: toSumopodMessages(systemInstruction, messages), ...getGenerationConfig(modelId, mode, inputText ?? (typeof last === 'string' ? last : ''), maxTokens), stream }) } };
}
export class StreamFailure extends Error { }
export async function* parseOpenAITextStream(response: Response): AsyncGenerator<string> {
  if (!response.body) throw new StreamFailure('Empty upstream stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', finished = false, visible = false;
  function parse(frame: string): string[] {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return [];
    if (data.trim() === '[DONE]') { finished = true; return []; }
    let p;
    try { p = JSON.parse(data); } catch { throw new StreamFailure('Malformed upstream frame.'); }
    if (p.error || /^event:\s*error/im.test(frame)) throw new StreamFailure('Upstream stream failed.');
    const choice = p.choices?.[0];
    if (choice?.finish_reason === 'length') throw new StreamFailure('Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan.');
    if (choice?.finish_reason === 'content_filter') throw new StreamFailure('Respons dihentikan oleh penyedia.');
    if (choice?.finish_reason === 'stop') finished = true;
    const content = choice?.delta?.content;
    if (typeof content === 'string' && content) { visible = true; return [content]; }
    return [];
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 256_000) throw new StreamFailure('Upstream frame exceeds limit.');
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) { for (const value of parse(frame)) yield value; if (finished) break; }
      if (finished) break;
    }
    buffer += decoder.decode();
    if (!finished && buffer.trim()) for (const value of parse(buffer)) yield value;
    if (!finished) throw new StreamFailure('Koneksi model terputus sebelum jawaban selesai.');
    if (!visible) throw new StreamFailure('Model tidak mengirim jawaban teks.');
  } finally { try { await reader.cancel(); } catch { /* already cancelled */ } reader.releaseLock(); }
}
