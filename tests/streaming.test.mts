import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenAITextStream } from '../lib/sumopod.ts';
import { readChatEvents } from '../lib/chat-stream.ts';
const frame=(content:string)=>'data: '+JSON.stringify({choices:[{delta:{content}}]})+'\r\n\r\n';
async function collect(response:Response){const chunks=[];for await(const c of parseOpenAITextStream(response))chunks.push(c);return chunks.join('');}
test('UTF-8 and SSE frame boundaries may split at every byte',async()=>{
 const data=new TextEncoder().encode(': heartbeat\r\n\r\n'+frame('Halo 👋 é')+'data: [DONE]\r\n\r\n');
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
