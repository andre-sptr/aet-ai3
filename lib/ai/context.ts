import { ApiError, object } from '../http.ts';
import type { ChatMode, Message } from '../../types/index.ts';
export function validateChat(body: Record<string, unknown>): { mode: ChatMode; messages: Message[]; model?: string; frontierAccessToken?: unknown } {
  if (!['daily','report','coding'].includes(String(body.mode))) throw new ApiError(400, 'Mode percakapan tidak valid.');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 200) throw new ApiError(400, 'Percakapan harus berisi 1–200 pesan.');
  let characters = 0;
  const messages = body.messages.map(value => {
    const d = object(value);
    if (!['user','assistant','model'].includes(String(d.role)) || typeof d.content !== 'string' || d.content.length > 40_000) throw new ApiError(400, 'Format pesan tidak valid.');
    characters += d.content.length;
    if (d.status === 'error' || d.status === 'cancelled' || d.status === 'streaming') throw new ApiError(400, 'Jangan sertakan respons gagal/belum selesai pada konteks model.');
    let attachment: Message['attachment'];
    if (d.attachment !== undefined) {
      const a = object(d.attachment);
      if (d.role !== 'user' || !['image','file'].includes(String(a.type)) || typeof a.content !== 'string' || a.content.length > 7_000_000 || typeof a.mimeType !== 'string' || typeof a.fileName !== 'string' || a.fileName.length > 200 || (a.extractedText !== undefined && (typeof a.extractedText !== 'string' || a.extractedText.length > 24_000))) throw new ApiError(400, 'Lampiran tidak valid.');
      attachment = a as unknown as Message['attachment'];
      characters += typeof a.extractedText === 'string' ? a.extractedText.length : 0;
    }
    return { id: typeof d.id === 'string' ? d.id.slice(0,100) : '', role: d.role as Message['role'], content: d.content, timestamp: new Date(), attachment };
  });
  if (characters > 200_000) throw new ApiError(413, 'Percakapan terlalu panjang. Buka percakapan baru.');
  const last = messages.at(-1)!;
  if (last.role !== 'user' || (!last.content.trim() && !last.attachment)) throw new ApiError(400, 'Pesan terakhir harus berupa permintaan pengguna.');
  if (body.model !== undefined && typeof body.model !== 'string') throw new ApiError(400, 'Model tidak valid.');
  return { mode: body.mode as ChatMode, messages, model: body.model as string | undefined, frontierAccessToken: body.frontierAccessToken };
}
export function selectContext(messages: Message[], maxChars = 48_000): { messages: Message[]; truncated: boolean } {
  const selected: Message[] = [];
  let size = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const n = m.content.length + (m.attachment?.extractedText?.length || 0);
    if (!selected.length && n > maxChars) throw new ApiError(413, 'Pesan terakhir beserta lampirannya terlalu panjang. Ringkas pesan atau pecah dokumen menjadi bagian lebih kecil.', 'CONTEXT_LIMIT');
    if (selected.length && (size + n > maxChars || selected.length >= 40)) break;
    selected.unshift(m); size += n;
  }
  while (selected.length > 1 && selected[0].role !== 'user') selected.shift();
  return { messages: selected, truncated: selected.length < messages.length };
}
