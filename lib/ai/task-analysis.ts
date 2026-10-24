import type { ChatMode, Message } from '../../types/index.ts';
import { isFollowup, type ConversationState } from './conversation-state.ts';
export function analyzeTask(messages: Message[], state: ConversationState, persona: ChatMode) {
  const latest = messages.at(-1)!.content;
  const relevant = [state.activeGoal?.text, ...state.constraints.slice(-5).map(c=>c.text), isFollowup(latest) ? state.reference.excerpt : '', latest].filter(Boolean).join('\n');
  const complex = relevant.length > 1200 || /\b(?:bandingkan|compare|analisis mendalam|multi|arsitektur|buktikan|debug|uji|research|evaluasi|rencana bisnis)\b/i.test(relevant) || state.conflicts.length > 0;
  const needsFreshEvidence = /\b(?:terbaru|hari ini|saat ini|harga sekarang|latest|current|today|telusuri|search|carikan|cari di web)\b/i.test(latest);
  const compare = /\b(?:bandingkan|compare|perbandingan)\b/i.test(relevant);
  const needsReview = complex || persona === 'report' && relevant.length > 200 || /\b(?:hitung|calculate|DOI|referensi|citation|sitasi)\b/i.test(relevant);
  return { latest, relevant, complex, needsFreshEvidence, compare, needsReview, followup:isFollowup(latest) };
}
