import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import type { Evidence } from './personas/prompt-builder.ts';
let cache: { key: string; sections: string[] } | undefined;
export function needsAetKnowledge(text: string, previousUserText=''): boolean {
  return /\b(aet|hima|himpunan|pcr|politeknik caltex)\b/i.test(text) || /\b(ketua(?:nya)?|berdiri|atribut(?:nya)?|divisi(?:nya)?|pengurus(?:nya)?|anggotanya|visinya|misinya)\b/i.test(text) && /\b(aet|hima|pcr)\b/i.test(previousUserText);
}
export async function retrieveAetKnowledge(text: string, previousUserText=''): Promise<Evidence[]> {
  if(!needsAetKnowledge(text,previousUserText))return [];
  const file=path.join(process.cwd(),'app','AETPCR.docx');
  try {
    const info=await stat(file);const key=`${info.mtimeMs}:${info.size}`;
    if(!cache || cache.key!==key){
      const raw=(await mammoth.extractRawText({buffer:await readFile(file)})).value;
      const paragraphs=raw.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);const sections:string[]=[];
      for(const p of paragraphs){if(sections.length && sections.at(-1)!.length+p.length<1400)sections[sections.length-1]+='\n'+p;else sections.push(p);}
      cache={key,sections};
    }
    const words=[...new Set(text.toLowerCase().match(/[\p{L}\d]{3,}/gu)||[])].filter(w=>!['yang','dan','apa','siapa','bagaimana','tentang','untuk','aet','pcr'].includes(w));
    const ranked=cache.sections.map((s,index)=>({s,index,score:words.reduce((n,w)=>n+(s.toLowerCase().includes(w)?1:0),0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
    const chosen=[cache.sections[0],...ranked.filter(r=>r.score>0).slice(0,5).sort((a,b)=>a.index-b.index).map(r=>r.s)];
    return [{kind:'aet-knowledge',source:'Dokumen resmi AETPCR.docx (source proyek)',status:'ok',data:{updatedAt:info.mtime.toISOString(),excerpts:[...new Set(chosen)].join('\n\n').slice(0,12_000),note:'Hanya cuplikan relevan; informasi yang tidak ditemukan harus dinyatakan tidak tersedia.'}}];
  }catch{return[{kind:'aet-knowledge',source:'AETPCR.docx',status:'error',data:'Dokumen resmi tidak dapat dibaca. Jangan mengarang informasi organisasi.'}];}
}
