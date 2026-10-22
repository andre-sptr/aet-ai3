import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractDocument, attachmentText, decodeDataUrl } from '../lib/ai/attachments.ts';
import { validateImage } from '../lib/files.ts';
import { ApiError } from '../lib/http.ts';
test('PDF text extraction uses the installed pdf-parse v2 API',async()=>{
 await import('pdf-parse'); // Missing parser is an environment failure, never a PDF-validation pass.
 const result=await extractDocument(await readFile('tests/fixtures/valid.pdf'),'application/pdf');assert.match(result.text,/sensor reads temperature/);assert.equal(result.truncated,false);
});
for(const file of ['scan.pdf','encrypted.pdf','too-many-pages.pdf'])test(`rejects ${file} with a clear document error`,async()=>{
 await import('pdf-parse');
 await assert.rejects(()=>readFile('tests/fixtures/'+file).then(b=>extractDocument(b,'application/pdf')),e=>e instanceof ApiError&&(file==='too-many-pages.pdf'?e.status===413:e.status===422)&&(file!=='scan.pdf'||/lapisan teks/.test(e.message)));
});
test('DOCX extraction uses installed Mammoth',async()=>{
 await import('mammoth');
 const doc=await extractDocument(await readFile('app/AETPCR.docx'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');assert.match(doc.text,/AET/);
});
test('UTF-8 TXT extraction supports bounded text',async()=>{
 const txt=await extractDocument(Buffer.from('x'.repeat(30_000)),'text/plain');assert.equal(txt.text.length,24_000);assert.equal(txt.truncated,true);
});
test('invalid, empty, oversized and spoofed attachments rejected',async()=>{
 for(const [bytes,mime] of [[Buffer.from('not pdf'),'application/pdf'],[Buffer.alloc(0),'text/plain'],[Buffer.alloc(6*1024*1024),'text/plain'],[Buffer.from('a\0b'),'text/plain'],[Buffer.from('bad'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document']] as const)await assert.rejects(()=>extractDocument(bytes,mime),ApiError);
 assert.throws(()=>decodeDataUrl('https://example.com/picture'));
 assert.throws(()=>decodeDataUrl('data:text/plain;base64,%%%'));
 assert.throws(()=>validateImage(Buffer.from('<svg></svg>'),'image/png'));
});
test('unknown vision capability blocks image payload before calling gateway',async()=>{
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);
 await assert.rejects(()=>attachmentText({type:'image',mimeType:'image/png',fileName:'x.png',content:'data:image/png;base64,'+png.toString('base64')}),e=>(e as ApiError).code==='VISION_UNVERIFIED');
});
test('missing legacy attachment is acknowledged rather than hallucinated',async()=>{
 const text=await attachmentText({type:'file',mimeType:'application/pdf',fileName:'old.pdf',content:''});assert.match(String(text),/unggah ulang/);
});
