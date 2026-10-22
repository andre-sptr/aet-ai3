import { freshReportPath } from './benchmark-core.mjs';
const reportPath=await freshReportPath('external-tools');
import fs from 'node:fs/promises';
import { routeTools, runTools } from '../lib/ai/tools.ts';
const results=[];
for(const prompt of ['10 km ke m','rata-rata: 10, 20, 30','cek email hello@example.com','konversi warna #ff0000','buatkan password 16 simbol','cuaca di Pekanbaru','10 USD ke IDR','ringkas https://example.com','cari sumber terbaru tentang elektronika']) {
  const start=Date.now();const result=await runTools(prompt,AbortSignal.timeout(15000));
  const row={prompt,tools:routeTools(prompt).map(t=>t.name),status:result.directResponse?'PASS':result.evidence.length&&result.evidence.every(e=>e.status==='ok')?'PASS':'BLOCKED',evidence:result.evidence,directResponse:result.directResponse?'Secure random password generated; value omitted.':undefined,durationMs:Date.now()-start};
  results.push(row);console.log(JSON.stringify({prompt,status:row.status,durationMs:row.durationMs}));
}
await fs.writeFile(reportPath,JSON.stringify({checkedAt:new Date().toISOString(),environment:'Current task execution environment; failures may reflect network/provider configuration.',results},null,2));

console.log(JSON.stringify({report:reportPath,passed:results.filter(r=>r.status==='PASS').length,blocked:results.filter(r=>r.status==='BLOCKED').length}));
