import type { Evidence } from './personas/prompt-builder.ts';
import type { Issue } from './structured-output.ts';
import { checkOutputContract, outputContract } from './output-contract.ts';

/** Objective checks are deliberately narrow. URL membership checks provenance,
 * not whether a page actually entails a claim. A model review is advisory. */
export function checkAnswer(answer: string, userText: string, evidence: Evidence[]) {
  const issues: Issue[] = [];
  const checks = ['nonempty','citation_provenance'];
  if (!answer.trim()) issues.push({kind:'format',detail:'Jawaban kosong.'});
  const format = checkOutputContract(answer, outputContract(userText));
  if (format.contract) checks.push(format.contract === 'raw_json' ? 'json_parse' : format.contract);
  if (format.pass === false) issues.push({kind:'format',detail:format.detail!});
  const calculation = evidence.length === 1 && evidence[0].status === 'ok' && evidence[0].kind === 'calculator'
    ? (evidence[0].data as { result?: number }).result : undefined;
  if (calculation !== undefined && ['integer','number'].includes(format.contract ?? '') && format.pass === true) {
    checks.push('deterministic_calculation');
    if (Number(answer) !== calculation) issues.push({kind:'number',detail:'Angka berbeda dari hasil kalkulator deterministik yang diperoleh.'});
  }
  const acquired = JSON.stringify(evidence.filter(e => e.status === 'ok'));
  const prose=answer.replace(/```[\s\S]*?```/g,'').replace(/`[^`\n]+`/g,'');
  const urls = [...new Set(prose.match(/https?:\/\/[^\s)\]>"']+/g) ?? [])];
  for (const url of urls) if (!acquired.includes(url) && !userText.includes(url)) issues.push({kind:'citation',detail:`URL tidak ditemukan pada bukti yang benar-benar diperoleh: ${url.slice(0,200)}`});
  const dois = [...new Set(answer.match(/10\.\d{4,9}\/[\w.()/:;-]+/g) ?? [])];
  for (const doi of dois) if (!acquired.includes(doi) && !userText.includes(doi)) issues.push({kind:'citation',detail:`DOI tidak didukung bukti yang diperoleh: ${doi.slice(0,160)}`});
  if (/\b(?:saya|i)\s+(?:sudah|telah|have)\s+(?:menguji|menjalankan tes|tested|run tests)\b/i.test(answer)) issues.push({kind:'evidence',detail:'Tidak ada tool eksekusi kode pada aplikasi. Jangan mengklaim telah menjalankan pengujian.'});
  return {checks,issues:issues.slice(0,8)};
}
export function limitation(language: 'id' | 'en' | 'follow_user', issues: Issue[]): string {
  const details=[...new Set(issues.map(i=>i.kind==='citation'?(language==='en'?'Some references lack supporting evidence.':'Sebagian referensi belum memiliki bukti pendukung.'):i.detail))].join(' ');
  return language === 'en' ? `Some checks remain unresolved: ${details}` : `Pemeriksaan yang belum terselesaikan: ${details}`;
}
