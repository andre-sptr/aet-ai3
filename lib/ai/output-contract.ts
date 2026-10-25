/** Explicit, narrow output contracts from direct user instructions only.
 * Detection is not a semantic schema validator or a general intent parser. */
export type OutputContract = 'raw_json' | 'integer' | 'number' | 'raw_code';
export const OUTPUT_CONTRACT_VERSION = 'explicit-output-v1';
export function hasOutputDirective(text: string): boolean {
  const directive=text.replace(/```[\s\S]*?```/g,'');
  return Boolean(outputContract(directive)) || /\b(?:jawab|respond|return|keluarkan|ganti format|ubah format)\b[^.!?\n]{0,80}\b(?:paragraf|prosa|markdown|penjelasan|format|JSON|angka|kode)\b/i.test(directive);
}
export function outputContract(userText: string): OutputContract | null {
  const text = userText.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  if (/\b(?:jangan|tidak perlu|do not|don't)\s+(?:(?:jawab|gunakan|pakai|output|use|return)\s+)?(?:hanya\s+)?JSON\b/i.test(text)) return null;
  if (/\b(?:hanya|only|raw)\s+(?:format\s+)?JSON\b|\bJSON\s+(?:mentah|saja|only)\b/i.test(text)) return 'raw_json';
  if (/\b(?:kode|code)(?:\s+(?:JavaScript|TypeScript|Python|SQL))?\s+(?:mentah|saja|only)\b|\braw\s+(?:(?:JavaScript|TypeScript|Python|SQL)\s+)?code\b|\bonly\s+(?:raw\s+)?code\b/i.test(text)) return 'raw_code';
  if (/\b(?:jawab|berikan|keluarkan|reply|return|output|respond)\s+(?:(?:dengan|with|only|hanya)\s+)?(?:angka|number|integer)(?:\s+(?:rupiah|bulat|utuh|saja|only|integer)){0,4}\s*(?:saja|only|tanpa|without)\b|\b(?:hanya|only)\s+(?:angka|number|integer)(?:\s+(?:rupiah|bulat|utuh))?\b/i.test(text)) {
    return /\b(?:bulat|utuh|integer|rupiah)\b/i.test(text) ? 'integer' : 'number';
  }
  return null;
}
export function checkOutputContract(answer: string, contract: OutputContract | null): { contract: OutputContract | null; pass: boolean | null; detail?: string } {
  if (!contract) return { contract, pass: null };
  let pass: boolean;
  if (contract === 'raw_json') {
    try { JSON.parse(answer); pass = true; } catch { pass = false; }
  } else if (contract === 'integer') pass = /^-?(?:0|[1-9]\d*)$/.test(answer.trim());
  else if (contract === 'number') pass = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(answer.trim());
  else pass = !/```|^\s*(?:berikut|tentu|here (?:is|are))\b/i.test(answer);
  return { contract, pass, ...(pass ? {} : { detail: `Kontrak ${contract} belum dipenuhi; keluaran harus mentah tanpa pagar Markdown, simbol tambahan, atau penjelasan.` }) };
}
