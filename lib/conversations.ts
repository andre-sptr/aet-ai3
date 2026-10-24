import { createId } from './ids.ts';
import type { ChatMode, Message, ResponseMode } from '../types/index.ts';
import { deriveConversationState, type ConversationState } from './ai/conversation-state.ts';
export type Conversation = { id: string; title: string; mode: ChatMode; modelId: string; responseMode?: ResponseMode; derivedState?: ConversationState; messages: Message[]; updatedAt: string };
export type ConversationStore = { version: 2; activeId: string; conversations: Conversation[] };
export const conversationKey = (mode: ChatMode) => `aet_ai_conversations_v2_${mode}`;
export const legacyKey = (mode: ChatMode) => `aet_ai_chat_history_${mode}`;
export function newConversation(mode: ChatMode, messages: Message[] = []): Conversation {
  return { id: createId(), title: 'Percakapan baru', mode, modelId: 'gpt-4o-mini', responseMode:'normal', messages, updatedAt: new Date().toISOString() };
}
function hydrate(messages: unknown): Message[] {
  if(!Array.isArray(messages))throw new Error('Riwayat tidak valid.');
  return messages.map(raw=>{
    if(!raw||!['user','assistant','model'].includes(raw.role)||typeof raw.content!=='string')throw new Error('Riwayat tidak valid.');
    const timestamp=new Date(raw.timestamp);
    return {...raw,id:typeof raw.id==='string'?raw.id:createId(),timestamp:Number.isFinite(timestamp.getTime())?timestamp:new Date(0),status:raw.status==='streaming'?'cancelled':raw.status||(raw.content.startsWith('Maaf, terjadi kesalahan:')?'error':'complete')};
  });
}
export function loadConversationStore(storage: Pick<Storage,'getItem'>, mode: ChatMode): ConversationStore {
  const current=storage.getItem(conversationKey(mode));
  if(current){
    const data=JSON.parse(current);
    if(data.version!==2||!Array.isArray(data.conversations))throw new Error('Format riwayat baru tidak valid. Data asli tetap disimpan.');
    const conversations=data.conversations.map((c:Conversation)=>{
      if(c.mode!==mode||typeof c.id!=='string'||typeof c.title!=='string'||typeof c.modelId!=='string')throw new Error('Format percakapan tidak valid.');
      const messages = hydrate(c.messages);
      return{...c,messages,responseMode:c.responseMode === 'fast' || c.responseMode === 'think' ? c.responseMode : 'normal',derivedState:deriveConversationState(historyForModel(messages))};
    });
    if(new Set(conversations.map((c:Conversation)=>c.id)).size!==conversations.length)throw new Error('ID percakapan ganda. Data asli tetap disimpan.');
    // A durable empty v2 store is a tombstone: never re-import deleted legacy data.
    if(!conversations.length){const chat=newConversation(mode);return{version:2,activeId:chat.id,conversations:[chat]};}
    return{version:2,activeId:conversations.some((c:Conversation)=>c.id===data.activeId)?data.activeId:conversations[0].id,conversations};
  }
  const legacy=storage.getItem(legacyKey(mode));
  const chat=newConversation(mode,legacy?hydrate(JSON.parse(legacy)):[]);
  if(legacy)chat.title='Riwayat sebelumnya';
  return{version:2,activeId:chat.id,conversations:[chat]};
}
export function lightweightStore(store: ConversationStore): ConversationStore {
  const conversations=savedConversations(store).map(c=>({...c,derivedState:deriveConversationState(historyForModel(c.messages)),messages:c.messages.map(m=>m.attachment?{...m,attachment:{...m.attachment,content:''}}:m)}));
  return{...store,activeId:conversations.some(c=>c.id===store.activeId)?store.activeId:'',conversations};
}
/** Drafts and greeting-only sessions exist in memory, not in the history list. */
export function savedConversations(store: ConversationStore): Conversation[] {
  return store.conversations.filter(c=>c.messages.some(m=>m.role==='user'));
}
export function removeConversation(store: ConversationStore, id: string, mode: ChatMode): ConversationStore {
  if(!store.conversations.some(c=>c.id===id))return store;
  const conversations=store.conversations.filter(c=>c.id!==id);
  if(!conversations.length)conversations.push(newConversation(mode));
  const fallback=conversations.find(c=>c.messages.some(m=>m.role==='user'))||conversations[0];
  return{...store,activeId:conversations.some(c=>c.id===store.activeId)?store.activeId:fallback.id,conversations};
}
type HistoryStorage = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function persistConversationStore(storage: Pick<Storage,'setItem'>, mode: ChatMode, store: ConversationStore): void {
  if(store.conversations.some(c=>c.mode!==mode))throw new Error('Mode penyimpanan riwayat tidak cocok.');
  storage.setItem(conversationKey(mode),JSON.stringify(lightweightStore(store)));
}
/** Called by timers AND effect cleanup. A superseded snapshot must never be written. */
export function saveCurrentSnapshot(storage: Pick<Storage,'setItem'>, mode: ChatMode, snapshot: ConversationStore, current: ConversationStore | null): boolean {
  if(snapshot!==current || snapshot.conversations.some(c=>c.mode!==mode))return false;
  persistConversationStore(storage,mode,snapshot);
  return true;
}
/** Persist first; callers publish the new React/ref state only after this succeeds. */
export function deleteStoredConversation(storage: HistoryStorage, mode: ChatMode, current: ConversationStore, id: string): ConversationStore {
  const next=removeConversation(current,id,mode);
  if(next===current)return current;
  if(storage.getItem(legacyKey(mode))!==null){
    // Ensure migration is durable before removing its old copy. Failure at any step
    // leaves a valid store and is surfaced by the caller, never reported as success.
    persistConversationStore(storage,mode,current);
    storage.removeItem(legacyKey(mode));
  }
  persistConversationStore(storage,mode,next);
  return next;
}
export function historyForModel(messages: Message[]): Message[] {
  const first=messages.findIndex(m=>m.role==='user');
  return first<0?[]:messages.slice(first).filter(m=>!m.status||m.status==='complete').map(m=>m.attachment?.extractedText?{...m,attachment:{...m.attachment,content:''}}:m);
}
export function retryHistory(messages: Message[]): Message[] {
  const index=messages.findLastIndex(m=>m.role==='user');
  return index<0?[]:messages.slice(0,index+1);
}
