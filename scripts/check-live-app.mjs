import { assertPaidBudget, freshReportPath } from './benchmark-core.mjs';
await assertPaidBudget();
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { mkdtemp, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { readChatEvents } from '../lib/chat-stream.ts';
if(!process.env.SUMOPOD_API_KEY||process.env.AET_LIVE_TEST_APPROVED!=='true')throw new Error('Approved provider-capped API key required.');
const reportPath=await freshReportPath('live-app');
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const directory=await mkdtemp(join(tmpdir(),'aet-live-'));const database=join(directory,'test.db');await copyFile('prisma/dev.db',database);
const origin=`http://127.0.0.1:${port}`;
const env={...process.env,NODE_ENV:'production',APP_ORIGIN:origin,DATABASE_URL:`file:${database}`,ENABLE_FRONTIER:'false',TRUST_PROXY:'false',CHAT_HOURLY_LIMIT:'100'};
const require=createRequire(import.meta.url);let server;const results=[];
const stop=()=>server?.kill('SIGTERM');process.once('SIGINT',stop);process.once('SIGTERM',stop);
async function ask(name,mode,prompt,extra={},check=text=>Boolean(text.trim())) {
  const row={name,mode,model:'gpt-4o-mini',status:'FAIL'};const started=Date.now();
  try {
    const response=await fetch(origin+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream',Origin:origin},body:JSON.stringify({mode,model:'gpt-4o-mini',messages:[{role:'user',content:prompt}],...extra}),signal:AbortSignal.timeout(65000)});
    row.httpStatus=response.status;
    if(!response.ok){row.error=(await response.json()).code;}
    else {let text='';for await(const event of readChatEvents(response)){if(event.event==='delta')text+=event.data.text;if(event.event==='meta')row.sources=event.data.sources;}row.output=text;row.status=check(text)?'PASS':'FAIL';}
  }catch(error){row.error=error.message;}
  row.durationMs=Date.now()-started;results.push(row);console.log(JSON.stringify({name,status:row.status,durationMs:row.durationMs}));
}
try {
  server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{env,stdio:['ignore','ignore','ignore']});
  let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw new Error('Live app test server exited.');try{ready=(await fetch(origin,{signal:AbortSignal.timeout(2000)})).ok;}catch{}if(ready)break;await delay(500);}if(!ready)throw new Error('Live app test server unavailable.');
  await ask('Smart Companion live streaming','daily','Jelaskan fungsi RAM dalam dua kalimat.');
  await ask('Academic Writer live streaming','report','Jelaskan perbedaan korelasi dan kausalitas dalam penelitian, cukup satu paragraf.',{},text=>/korelasi/i.test(text)&&/kausalitas/i.test(text));
  await ask('Academic Writer avoids fabricated DOI','report','Saya tidak punya sumber. Jangan buat referensi palsu. Sebutkan apakah DOI jurnal tentang AET yang belum diberikan bisa dipastikan.',{},text=>!(/10\.\d{4,9}\//.test(text)));
  await ask('Coding Expert returns exact executable output','coding','Apa output print(2 + 4) dalam Python? Jawab angka saja.',{},text=>text.trim()==='6');
  await ask('Latest user correction retained','daily','Berapa anggaran saya sekarang? Jawab nominal saja.',{messages:[{role:'user',content:'Anggaran saya 500 ribu rupiah.'},{role:'assistant',content:'Anggaran Anda 500 ribu rupiah.'},{role:'user',content:'Koreksi: sekarang anggaran saya 900 ribu rupiah.'},{role:'assistant',content:'Anggaran sudah dikoreksi.'},{role:'user',content:'Berapa anggaran saya sekarang? Jawab nominal saja.'}]},text=>/900/.test(text)&&!/500/.test(text));
  await ask('Official AET knowledge retrieved','daily','Tanggal berapa AET PCR resmi berdiri?',{},text=>/1\s+April\s+2008/i.test(text));
  const document=await fetch(origin+'/api/attachments',{method:'POST',headers:{'Content-Type':'application/pdf',Origin:origin},body:await readFile('tests/fixtures/valid.pdf')});
  if(!document.ok)throw new Error('PDF extraction endpoint failed.');const extracted=await document.json();
  await ask('PDF extraction through live chat','daily','Menurut lampiran, sensor ini membaca apa? Jawab singkat.',{messages:[{role:'user',content:'Menurut lampiran, sensor ini membaca apa? Jawab singkat.',attachment:{type:'file',fileName:'fixture.pdf',mimeType:'application/pdf',content:'',extractedText:extracted.text}}]},text=>/temperature|suhu/i.test(text));
  await ask('Deterministic conversion with real model and source metadata','daily','10 km ke m',{},text=>/10[., ]?000/.test(text));
  const image='data:image/png;base64,'+(await readFile('tests/fixtures/vision-colors.png')).toString('base64');
  await ask('Vision through production app route','daily','Sebutkan warna bagian kiri dan kanan gambar dalam bahasa Inggris. Jawab dua warna saja.',{messages:[{role:'user',content:'Sebutkan warna bagian kiri dan kanan gambar dalam bahasa Inggris. Jawab dua warna saja.',attachment:{type:'image',fileName:'colors.png',mimeType:'image/png',content:image}}]},text=>/red/i.test(text)&&/blue/i.test(text));
} finally {
  stop();if(server&&server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));await rm(directory,{recursive:true,force:true});
  const report={checkedAt:new Date().toISOString(),environment:'Local production Next.js, copied SQLite, actual Sumopod gateway',budgetCapUsd:Number(process.env.AET_TEST_BUDGET_USD||3),total:results.length,passed:results.filter(r=>r.status==='PASS').length,results};
  await writeFile(reportPath,JSON.stringify(report,null,2));if(report.passed!==report.total)process.exitCode=1;
}
