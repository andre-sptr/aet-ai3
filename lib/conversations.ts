import { createId } from './ids.ts';
import type { ChatMode, Message } from '../types/index.ts';
export type Conversation = { id: string; title: string; mode: ChatMode; modelId: string; messages: Message[]; updatedAt: string };
export type ConversationStore = { version: 2; activeId: string; conversations: Conversation[] };
export const conversationKey = (mode: ChatMode) => `aet_ai_conversations_v2_${mode}`;
export const legacyKey = (mode: ChatMode) => `aet_ai_chat_history_${mode}`;
export function newConversation(mode: ChatMode, messages: Message[] = []): Conversation {
  return { id: createId(), title: 'Percakapan baru', mode, modelId: 'gpt-4o-mini', messages, updatedAt: new Date().toISOString() };
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
    if(data.version!==2||!Array.isArray(data.conversations)||!data.conversations.length)throw new Error('Format riwayat baru tidak valid. Data asli tetap disimpan.');
    const conversations=data.conversations.map((c:Conversation)=>{
      if(c.mode!==mode||typeof c.id!=='string'||typeof c.title!=='string'||typeof c.modelId!=='string')throw new Error('Format percakapan tidak valid.');
      return{...c,messages:hydrate(c.messages)};
    });
    return{version:2,activeId:conversations.some((c:Conversation)=>c.id===data.activeId)?data.activeId:conversations[0].id,conversations};
  }
  const legacy=storage.getItem(legacyKey(mode));
  const chat=newConversation(mode,legacy?hydrate(JSON.parse(legacy)):[]);
  if(legacy)chat.title='Riwayat sebelumnya';
  return{version:2,activeId:chat.id,conversations:[chat]};
}
export function lightweightStore(store: ConversationStore): ConversationStore {
  return{...store,conversations:store.conversations.map(c=>({...c,messages:c.messages.map(m=>m.attachment?{...m,attachment:{...m.attachment,content:''}}:m)}))};
}
export function historyForModel(messages: Message[]): Message[] {
  const first=messages.findIndex(m=>m.role==='user');
  return first<0?[]:messages.slice(first).filter(m=>!m.status||m.status==='complete').map(m=>m.attachment?.extractedText?{...m,attachment:{...m.attachment,content:''}}:m);
}
export function retryHistory(messages: Message[]): Message[] {
  const index=messages.findLastIndex(m=>m.role==='user');
  return index<0?[]:messages.slice(0,index+1);
}
