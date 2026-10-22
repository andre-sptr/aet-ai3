import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenAITextStream } from '../lib/sumopod.ts';
import { readChatEvents } from '../lib/chat-stream.ts';
const frame=(content:string)=>'data: '+JSON.stringify({choices:[{delta:{content}}]})+'\r\n\r\n';
async function collect(response:Response){const chunks=[];for await(const c of parseOpenAITextStream(response))chunks.push(c);return chunks.join('');}
test('UTF-8 and SSE frame boundaries may split at every byte',async()=>{
 const data=new TextEncoder().encode(': heartbeat\r\n\r\n'+frame('Halo 👋 é')+'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n');
 const body=new ReadableStream({start(c){for(const byte of data)c.enqueue(new Uint8Array([byte]));c.close();}});
 assert.equal(await collect(new Response(body)),'Halo 👋 é');
});
test('malformed provider frame, provider error, empty output, interrupted EOF rejected',async()=>{
 for(const value of ['data: {bad}\n\n','data: {"error":{"message":"secret provider detail"}}\n\n','data: [DONE]\n\n',frame('partial')])await assert.rejects(()=>collect(new Response(value)));
});
test('generation output limit signals incomplete answer rather than silent success',async()=>{
 await assert.rejects(()=>collect(new Response(frame('partial')+'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n')),/keluaran/);
});
test('reader is cancelled when consumer stops before completion',async()=>{
 let cancelled=false;const r=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(frame('one')));},cancel(){cancelled=true;}}));
 for await(const text of parseOpenAITextStream(r)){assert.equal(text,'one');break;}assert.equal(cancelled,true);
});
test('client application SSE requires done and rejects error events',async()=>{
 const values=[];for await(const e of readChatEvents(new Response('event: delta\ndata: {"text":"ok"}\n\nevent: done\ndata: {}\n\n')))values.push(e.event);assert.deepEqual(values,['delta','done']);
 async function read(value:string){for await(const e of readChatEvents(new Response(value)))void e;}
 await assert.rejects(()=>read('event: delta\ndata: {"text":"partial"}\n\n'),/terputus/);
 await assert.rejects(()=>read('event: error\ndata: {"message":"failed"}\n\n'),/failed/);
});
test('DONE without a stop finish reason and unsupported tool endings are not complete text',async()=>{
 for(const suffix of ['data: [DONE]\n\n','data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n','data: {"choices":[{"delta":{},"finish_reason":"unknown"}]}\n\n']) {
  await assert.rejects(()=>collect(new Response(frame('partial')+suffix)));
 }
});
test('model mismatch is rejected before foreign model text is exposed',async()=>{
 let output='';
 await assert.rejects(async()=>{
  for await(const text of parseOpenAITextStream(new Response('data: {"model":"wrong-model","choices":[{"delta":{"content":"do not show"},"finish_reason":"stop"}]}\n\n'),{expectedModel:'gpt-4o-mini'}))output+=text;
 },/model/);
 assert.equal(output,'');
});
test('metadata records reported identity, usage and finish without storing private reasoning',async()=>{
 const metadata:unknown[]=[];let output='';
 const response=new Response('data: {"model":"gpt-4o-mini","usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15},"choices":[{"delta":{"content":"ok","reasoning_content":"PRIVATE"},"finish_reason":"stop"}]}\n\n');
 for await(const text of parseOpenAITextStream(response,{expectedModel:'gpt-4o-mini',onMetadata:m=>metadata.push(m)}))output+=text;
 assert.equal(output,'ok');assert.match(JSON.stringify(metadata),/total_tokens/);assert.doesNotMatch(JSON.stringify(metadata),/PRIVATE|reasoning_content/);
});
test('benchmark reader captures usage sent after stop without appending any extra answer',async()=>{
 const metadata:{usage?:{total_tokens?:number}}[]=[];let output='';
 const response=new Response(frame('ok')+'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'+'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}\n\ndata: [DONE]\n\n');
 for await(const text of parseOpenAITextStream(response,{readUsageAfterStop:true,onMetadata:m=>metadata.push(m)}))output+=text;
 assert.equal(output,'ok');assert.ok(metadata.some(m=>m.usage?.total_tokens===12));
});
test('whitespace-only responses and primitive frames fail closed',async()=>{
 for(const raw of [frame('   ')+'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n','data: null\n\n','data: []\n\n'])await assert.rejects(()=>collect(new Response(raw)));
});
test('abort interrupts a reader waiting without another chunk, on server and client parsers',async()=>{
 for(const parser of [parseOpenAITextStream,readChatEvents]){
  const controller=new AbortController();let cancelled=false;
  const response=new Response(new ReadableStream({cancel(){cancelled=true;}}));
  const reading=(async()=>{for await(const item of parser===parseOpenAITextStream?parseOpenAITextStream(response,{signal:controller.signal}):readChatEvents(response,controller.signal))void item;})();
  controller.abort(new Error('cancelled by user'));
  await assert.rejects(()=>reading,/cancelled by user/);assert.equal(cancelled,true);
 }
});
