import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNews, validateEvent, validateTeam, eventDate } from '../lib/cms-validation.ts';
import { createId } from '../lib/ids.ts';
import { loadConversationStore, lightweightStore, historyForModel, retryHistory, newConversation, conversationKey, legacyKey } from '../lib/conversations.ts';
test('news validates slug, publication boolean and safe image URL',()=>{
 const valid={title:'Berita',slug:'berita-aet',content:'Isi'};assert.equal(validateNews(valid).published,false);
 for(const patch of [{slug:'../private'},{published:'false'},{imageUrl:'javascript:alert(1)'},{content:''}])assert.throws(()=>validateNews({...valid,...patch}));
});
test('event calendar dates, ordering and explicit WIB parse are correct',()=>{
 assert.equal(eventDate('2026-10-21T12:00').toISOString(),'2026-10-21T05:00:00.000Z');
 assert.throws(()=>eventDate('2026-02-30T12:00'));
 assert.throws(()=>validateEvent({title:'test',description:'test',startDate:'2026-10-21T12:00',endDate:'2026-10-20T12:00'}));
});
test('team ordering and social links validated',()=>{
 assert.equal(validateTeam({name:'A',position:'B',order:'12',socials:'{"instagram":"https://instagram.com/test"}'}).order,12);
 assert.throws(()=>validateTeam({name:'A',position:'B',order:'2abc'}));
 assert.throws(()=>validateTeam({name:'A',position:'B',socials:'{"x":"javascript:alert(1)"}'}));
});
const message={id:'old-id',role:'user' as const,content:'riwayat penting',timestamp:new Date(),attachment:{type:'file' as const,fileName:'old.txt',mimeType:'text/plain',content:'binary',extractedText:'retained document text'}};
test('legacy migration preserves stable IDs, content, key and date',()=>{
 const raw=JSON.stringify([message]);const values=new Map([[legacyKey('daily'),raw]]);const store=loadConversationStore({getItem:k=>values.get(k)||null},'daily');
 assert.equal(store.conversations[0].messages[0].id,'old-id');assert.equal(store.conversations[0].messages[0].content,'riwayat penting');assert.ok(store.conversations[0].messages[0].timestamp instanceof Date);assert.equal(values.get(legacyKey('daily')),raw);
});
test('new store restores chosen historical model, strips binary only, no silent substitution',()=>{
 const c=newConversation('daily',[message]);c.modelId='gpt-5.1';const data={version:2 as const,activeId:c.id,conversations:[c]};
 const raw=JSON.stringify(lightweightStore(data));const restored=loadConversationStore({getItem:k=>k===conversationKey('daily')?raw:null},'daily');
 assert.equal(restored.conversations[0].modelId,'gpt-5.1');assert.equal(restored.conversations[0].messages[0].attachment?.content,'');assert.equal(restored.conversations[0].messages[0].attachment?.extractedText,'retained document text');
});
test('retry targets last user exactly once and excludes failed responses from context',()=>{
 const failed={id:'failed',role:'assistant' as const,content:'provider error',timestamp:new Date(),status:'error' as const};
 const messages=[message,failed];assert.deepEqual(retryHistory(messages),[message]);assert.equal(historyForModel(messages).length,1);assert.equal(historyForModel(messages)[0].attachment?.content,'');
});
test('invalid store never silently falls back and overwrites legacy data',()=>{
 assert.throws(()=>loadConversationStore({getItem:()=>'{bad'},'daily'));
});

test('client message IDs use secure random bytes without requiring randomUUID',()=>{
 const ids=Array.from({length:100},()=>createId());assert.equal(new Set(ids).size,100);for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
