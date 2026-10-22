import test from 'node:test';
import assert from 'node:assert/strict';
import { responseLength } from '../lib/ai/personas/response-policy.ts';
import { getGenerationConfig } from '../lib/ai/model-config.ts';
import { selectContext } from '../lib/ai/context.ts';
import { readChatEvents } from '../lib/chat-stream.ts';
import { evidenceSources } from '../lib/ai/evidence.ts';
import { runTools, routeTools } from '../lib/ai/tools.ts';
import { eventStatus } from '../lib/events.ts';
import { prepareMessages } from '../lib/ai/message-context.ts';
import { readFile } from 'node:fs/promises';
import { citationPolicyResponse } from '../lib/ai/citation-policy.ts';
import type { Message } from '../types/index.ts';

test('explicit word targets receive room to finish and remain bounded', () => {
  assert.equal(responseLength('Tulis esai 1000 kata'), 'long');
  assert.equal(responseLength('Ringkas dalam 300 kata'), 'medium');
  assert.ok(getGenerationConfig('gpt-4o-mini', 'report', 'Esai 1000 kata').max_tokens >= 3000);
  assert.equal(getGenerationConfig('gpt-4o-mini', 'report', 'Esai 9000 kata').max_tokens, 4096);
  assert.equal(getGenerationConfig('gpt-4o-mini', 'daily', 'Jawab 12 kata').max_tokens, 512);
});
test('Gemini has tested headroom for invisible generation within output allowance', () => {
  assert.equal(getGenerationConfig('gemini/gemini-3.1-pro-preview', 'daily', 'jawab singkat').max_tokens, 1024);
});
test('latest message and resolved attachment cannot exceed context budget', () => {
  const user = {id:'u', role:'user', content:'x'.repeat(30_000), timestamp:new Date()} as Message;
  assert.throws(() => selectContext([{...user, attachment:{type:'file', fileName:'x.txt',mimeType:'text/plain',content:'',extractedText:'y'.repeat(24_000)}}]), /terlalu panjang/);
  const resolved = {...user,content:user.content+'y'.repeat(24_000)};
  assert.throws(() => selectContext([resolved]), /terlalu panjang/);
  const result = selectContext([{...user,id:'old',content:'y'.repeat(30_000)},user]);
  assert.equal(result.truncated,true);assert.deepEqual(result.messages,[user]);
});
test('application SSE completes immediately at done even if server keeps socket open', async () => {
  let cancelled=false;
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('event: done\ndata: {}\n\n'));},cancel(){cancelled=true;}}));
  for await (const e of readChatEvents(response)) assert.equal(e.event,'done');
  assert.equal(cancelled,true);
});
test('application SSE ignores trailing frames after done and rejects primitive payloads', async () => {
  const events=[];
  for await(const e of readChatEvents(new Response('event: done\ndata: {}\n\nevent: delta\ndata: {"text":"late"}\n\n')))events.push(e.event);
  assert.deepEqual(events,['done']);
  for(const payload of ['null','[]','"text"','42']) await assert.rejects(async()=>{for await(const e of readChatEvents(new Response(`event: meta\ndata: ${payload}\n\n`)))void e;}, /tidak valid/);
});
test('source provenance exposes actual search URLs and tool failure without trusting model links', () => {
  const result=evidenceSources([
    {kind:'search',source:'https://api.tavily.com/search',status:'ok',data:[{title:'Paper',url:'https://example.com/paper'},{title:'unsafe',url:'javascript:alert(1)'}]},
    {kind:'weather',source:'https://open-meteo.com',status:'error',data:'private upstream message'},
    {kind:'aet-knowledge',source:'AETPCR.docx',status:'ok',data:'text'},
  ]);
  assert.equal(result.length,3);assert.equal(result[0].url,'https://example.com/paper');assert.equal(result[1].status,'error');
  assert.doesNotMatch(JSON.stringify(result),/private upstream|javascript/);
});
test('negative instructions suppress deterministic tool execution', () => {
  for(const text of ['Jangan konversi 10 km ke m','Tidak perlu cari kurs 20 USD ke IDR',"Don't convert 10 km to m"])assert.deepEqual(routeTools(text),[]);
});
test('an aborted request cannot initiate external tool calls', async () => {
  await assert.rejects(() => runTools('cuaca di Pekanbaru',AbortSignal.abort(new Error('cancelled'))),/cancelled/);
});
test('events distinguish future, in progress and ended at exact boundaries', () => {
  const start='2026-10-22T01:00:00Z',end='2026-10-22T02:00:00Z';
  assert.equal(eventStatus(start,end,Date.parse(start)-1),'upcoming');
  assert.equal(eventStatus(start,end,Date.parse(start)),'ongoing');
  assert.equal(eventStatus(start,end,Date.parse(end)),'past');
  assert.equal(eventStatus(start,null,Date.parse(start)),'past');
});
test('verified vision sends actual image parts and text-only continuation preserves historical messages', async () => {
  const content='data:image/png;base64,'+(await readFile('tests/fixtures/vision-colors.png')).toString('base64');
  const image: Message={id:'i',role:'user',content:'Describe image',timestamp:new Date(),attachment:{type:'image',fileName:'colors.png',mimeType:'image/png',content}};
  const prepared=await prepareMessages([image],true);
  assert.equal(Array.isArray(prepared.messages[0].content),true);
  assert.match(JSON.stringify(prepared.messages),/image_url/);
  await assert.rejects(()=>prepareMessages([image],false),/belum terverifikasi/);
  const continuation=await prepareMessages([image,{id:'u2',role:'user',content:'Now explain RAM',timestamp:new Date()}],false);
  assert.equal(continuation.truncated,true);assert.doesNotMatch(JSON.stringify(continuation.messages),/data:image/);
  assert.equal(continuation.messages.at(-1)?.content,'Now explain RAM');
  assert.equal(image.attachment?.content,content);
});
test('image context limit keeps the newest four images with an explicit older-image notice', async () => {
  const content='data:image/png;base64,'+(await readFile('tests/fixtures/vision-colors.png')).toString('base64');
  const messages:Message[]=Array.from({length:6},(_,index)=>({id:String(index),role:'user',content:`image ${index}`,timestamp:new Date(),attachment:{type:'image',fileName:'image.png',mimeType:'image/png',content}}));
  const prepared=await prepareMessages(messages,true);
  assert.equal(prepared.truncated,true);assert.equal(prepared.messages.filter(m=>Array.isArray(m.content)).length,4);
});
test('citation examples and invented DOI requests cannot produce plausible fake sources', () => {
  const example=citationPolicyResponse('Tulis contoh format APA 7 untuk artikel jurnal menggunakan placeholder, tandai sebagai contoh fiktif.')!;
  const doi=citationPolicyResponse('Buatkan DOI untuk artikel berjudul AI dan Pendidikan karya Budi tahun 2025.')!;
  assert.match(example,/\[Penulis\]/);assert.match(doi,/tidak dapat dibuat/);
  assert.doesNotMatch(example+' '+doi,/10\.\d{4,9}\//);
  assert.equal(citationPolicyResponse('Jelaskan apa itu DOI'),undefined);
  assert.equal(citationPolicyResponse('Buatkan program validator DOI dengan Python'),undefined);
  assert.equal(citationPolicyResponse('Buatkan sitasi APA untuk DOI 10.1000/example'),undefined);
});
