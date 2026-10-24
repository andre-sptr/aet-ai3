import type { Message } from '../../types/index.ts';

export type StateEntry = { text: string; messageId: string; revision: string; provenance: 'user_statement' | 'model_hypothesis' | 'attachment'; key?: string; supersededBy?: string };
export type ConversationState = {
  schemaVersion: 1; revision: string; hashAlgorithm: 'dual-fnv32'; activeGoal: StateEntry | null;
  subtopics: StateEntry[]; constraints: StateEntry[]; corrections: StateEntry[]; superseded: StateEntry[];
  decisions: StateEntry[]; completed: StateEntry[]; pending: StateEntry[];
  attachments: (StateEntry & { name: string; available: boolean })[];
  assumptions: StateEntry[]; conflicts: StateEntry[]; unknowns: StateEntry[];
  language: 'id' | 'en' | 'follow_user';
  reference: { status: 'none' | 'resolved' | 'ambiguous'; messageIds: string[]; excerpt: string };
};
/** Deterministic change detector, NOT a cryptographic/authentication boundary. */
export function revisionOf(text: string): string {
  let a = 2166136261, b = 3339675911;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return `${(a >>> 0).toString(16).padStart(8,'0')}${(b >>> 0).toString(16).padStart(8,'0')}:${text.length}`;
}
export function messageRevision(m: Message): string {
  return revisionOf(JSON.stringify([m.id,m.role,m.content,m.status ?? 'complete',m.attachment ?? null]));
}
export function isFollowup(text: string): boolean {
  return /^(?:tolong\s+)?(?:lanjut(?:kan)?|continue|yang (?:pertama|kedua|ketiga|keempat|terakhir)|(?:nomor|opsi|bagian)\s*\d+|perbaiki (?:bagian )?(?:tadi|itu)|revise that|do the second|same as before)[\s.,!?\d\p{L}-]*$/iu.test(text.trim());
}
const constraintPattern = /\b(?:harus|jangan|tanpa|hanya|maksimal|minimal|tetap|pertahankan|kode|gunakan|pakai|format|bahasa|anggaran|budget|modal|ukuran|warna|deadline|must|never|only|use|keep|code|limit|language|length|rupiah)\b/i;
const correctionPattern = /\b(?:koreksi|ralat|bukan|ganti|sekarang|sebenarnya|correction|instead|actually|now|replace)\b/i;
function entryKey(text: string): string | undefined {
  const named = text.toLowerCase().match(/\b(anggaran|budget|modal|bahasa|language|format|ukuran|warna|deadline|nama|name|lokasi|location|jumlah|quantity|panjang|length|kode|code)\b/);
  if (named) return ({budget:'anggaran',modal:'anggaran',language:'bahasa',name:'nama',location:'lokasi',quantity:'jumlah',length:'panjang'} as Record<string,string>)[named[1]] ?? named[1];
  const assignment = text.match(/^\s*([\p{L}][\p{L} ]{1,30})\s*[:=]/u);
  return assignment?.[1].trim().toLowerCase();
}
/** Rebuild from the current valid branch on every request/load/save. Cached client
 * state is never merged: edits, deletions and retries cannot leave ghost facts. */
export function deriveConversationState(input: Message[]): ConversationState {
  const messages = input.filter(m => !m.status || m.status === 'complete');
  const state: ConversationState = { schemaVersion:1, revision:revisionOf(messages.map(messageRevision).join('|')), hashAlgorithm:'dual-fnv32', activeGoal:null,
    subtopics:[], constraints:[], corrections:[], superseded:[], decisions:[], completed:[], pending:[], attachments:[], assumptions:[], conflicts:[], unknowns:[], language:'follow_user', reference:{status:'none',messageIds:[],excerpt:''} };
  const entry = (m: Message, text: string, provenance: StateEntry['provenance'] = 'user_statement'): StateEntry => ({ text:text.slice(0,900), messageId:m.id, revision:messageRevision(m), provenance, key:entryKey(text) });
  for (const m of messages) {
    if (m.attachment) state.attachments.push({ ...entry(m, m.attachment.extractedText?.slice(0,500) || 'Lampiran memerlukan data asli untuk dianalisis.', 'attachment'), name:m.attachment.fileName, available:Boolean(m.attachment.content || m.attachment.extractedText) });
    if (m.role !== 'user') {
      if (/\b(?:asumsi|assum|mungkin|belum diketahui|unknown)\b/i.test(m.content)) state.assumptions.push(entry(m,m.content,'model_hypothesis'));
      continue;
    }
    const question=/^(?:berapa|apa|siapa|bagaimana|mengapa|kenapa|kapan|di mana|what|how|who|when|where|why)\b/i.test(m.content.trim());
    if (!isFollowup(m.content) && (!question || !state.activeGoal)) { state.activeGoal = entry(m,m.content); state.subtopics.push(state.activeGoal); }
    const sentences = m.content.split(/\n|(?<=[.!?])\s+/).filter(Boolean);
    for (const sentence of sentences) {
      const e = entry(m,sentence);
      const sentenceQuestion=/^(?:berapa|apa|siapa|bagaimana|mengapa|kenapa|kapan|di mana|what|how|who|when|where|why)\b/i.test(sentence.trim());
      if(sentenceQuestion)e.key=undefined;
      const correction = !sentenceQuestion && correctionPattern.test(sentence);
      if (constraintPattern.test(sentence) || correction || e.key) {
        if (correction) {
          state.corrections.push(e);
          if (e.key) {
            const old = state.constraints.filter(c => c.key === e.key);
            state.superseded.push(...old.map(c => ({...c,supersededBy:m.id})));
            state.constraints = state.constraints.filter(c => c.key !== e.key);
            state.conflicts = state.conflicts.filter(c => c.key !== e.key);
          }
        } else if (e.key && state.constraints.some(c => c.key === e.key && c.text !== e.text)) state.conflicts.push(e);
        state.constraints.push(e);
      }
      if (/\b(?:saya pilih|kami pilih|sepakat|putuskan|we chose|i choose|decided)\b/i.test(sentence)) state.decisions.push(e);
      if (/\b(?:sudah selesai|sudah diuji|telah selesai|completed|tests passed)\b/i.test(sentence)) state.completed.push(e);
      if (/\b(?:belum|masih perlu|pending|remaining|unknown|tidak tahu)\b/i.test(sentence)) state.unknowns.push(e);
    }
    state.pending = [entry(m,m.content)];
    // Explicit corrections win; inferred language remains an instruction to follow
    // the actual user text, not a fabricated preference.
    if (/\b(?:bahasa inggris|in english|use english)\b/i.test(m.content)) state.language = 'en';
    else if (/\b(?:bahasa indonesia|in indonesian)\b/i.test(m.content)) state.language = 'id';
  }
  const latest = messages.at(-1);
  if (latest?.role === 'user' && isFollowup(latest.content)) {
    const previous = messages.slice(0,-1).filter(m => m.role !== 'user').at(-1);
    if (previous) {
      const second = /kedua|second|(?:nomor|opsi|bagian)\s*2\b/i.test(latest.content);
      const numbered = previous.content.match(/^\s*2[.)]\s+[^\n]+/gm) ?? [];
      state.reference = { status:second && numbered.length > 1 ? 'ambiguous' : 'resolved', messageIds:[previous.id], excerpt:(second && numbered.length === 1 ? numbered[0] : previous.content).slice(0,1800) };
    }
  }
  state.constraints = state.constraints.slice(-24); state.corrections = state.corrections.slice(-12); state.superseded = state.superseded.slice(-12);
  state.subtopics = state.subtopics.slice(-6); state.decisions = state.decisions.slice(-12); state.completed = state.completed.slice(-8);
  state.attachments = state.attachments.slice(-8); state.assumptions = state.assumptions.slice(-4); state.conflicts = state.conflicts.slice(-8); state.unknowns = state.unknowns.slice(-8);
  return state;
}
