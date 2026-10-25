import fs from 'node:fs/promises';
import { auditScreeningReport, benchmarkInventory, FINAL_SCREENING_REPORT } from './routing-evidence-core.mjs';
const option=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const report=option('--report',FINAL_SCREENING_REPORT), output=option('--out','docs/benchmarks/routing-screening-20261025.json');
const audit=await auditScreeningReport(report);
audit.inventory=await benchmarkInventory();
const bytes=JSON.stringify(audit,null,2)+'\n';
if(process.argv.includes('--check')) {
  if(await fs.readFile(output,'utf8')!==bytes)throw new Error('Stored screening audit differs. Generate a new audit explicitly; never edit live reports.');
} else await fs.writeFile(output,bytes,{flag:'wx'});
console.log(JSON.stringify({report,output,checked:process.argv.includes('--check'),uniqueAttempts:audit.uniqueAttempts,statuses:audit.statuses,productionStatus:audit.productionStatus}));
