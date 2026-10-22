import { randomInt } from 'node:crypto';
import { boundedJson, safeReadWeb } from './safe-web.ts';
import type { Evidence } from './personas/prompt-builder.ts';
export type ToolCall = { name: string; args: string[] };
export function routeTools(text: string): ToolCall[] {
  // Explanations, quoted examples, and code must not trigger external actions.
  if (/```/.test(text) || /\b(contoh kalimat|jelaskan cara|explain how|arti kata)\b/i.test(text) || /\b(?:jangan|tidak perlu|tak perlu|do not|don't|no need to)\s+[^.,;:!\n]{0,60}\b(?:konversi|convert|cari|search|baca|read|cek|check|hitung|calculate|gunakan|use|jalankan|call|run|tools?|alat)\b/i.test(text)) return [];
  const calls: ToolCall[] = []; let m: RegExpMatchArray | null;
  if ((m = text.match(/(?:konversi(?:kan)?\s+)?(-?\d+(?:\.\d+)?)\s*(km|cm|mm|m|mi|ft|in|kg|mg|g|lb|oz|c|f|k)\s+(?:ke|to|=)\s*(km|cm|mm|m|mi|ft|in|kg|mg|g|lb|oz|c|f|k)\b/i))) calls.push({ name: 'unit', args: m.slice(1) });
  if ((m = text.match(/(?:kurs|konversi|convert|berapa)?\s*(\d+(?:\.\d+)?)\s*(USD|IDR|EUR|GBP|JPY|AUD|SGD|MYR|CNY|KRW|SAR|THB|CAD)\s+(?:ke|to|=)\s*(USD|IDR|EUR|GBP|JPY|AUD|SGD|MYR|CNY|KRW|SAR|THB|CAD)\b/i))) calls.push({ name:'currency',args:m.slice(1) });
  if ((m = text.match(/^(?:tolong\s+)?(?:bagaimana\s+)?(?:cek\s+)?(?:cuaca|weather)\s+(?:di|in|at)\s+([\p{L} .'-]{2,60})[?!.]?$/iu))) calls.push({name:'weather',args:[m[1].trim()]});
  if ((m = text.match(/^(?:tolong\s+)?(?:baca|ringkas|rangkum|buka|scrape|summarize|read)\s+(?:(?:halaman|artikel|web|url)\s+)?(https:\/\/[^\s]+)/i))) calls.push({name:'web',args:[m[1]]});
  else if ((m = text.match(/^(?:tolong\s+)?(?:carikan|cari|search|telusuri)\s+(?:di web\s+|internet\s+|web\s+)?(.{3,400})$/i)) || (m = text.match(/^(?:berita terbaru|latest news)\s+(.{3,400})$/i))) calls.push({name:'search',args:[m[1]]});
  if ((m = text.match(/^(?:tolong\s+)?(?:buatkan|buat|generate|bikin)\s+(?:password|kata sandi)(?:\s+(\d{1,3}))?(?:\s+karakter)?(?:\s+(?:dengan\s+)?(simbol|symbols))?[.!]?$/i))) calls.push({name:'password',args:[m[1]||'16',m[2]||'']});
  if ((m = text.match(/^(?:hitung|analisis|calculate)?\s*(?:rata-rata|mean|median|statistik|statistics)\s*(?:data)?\s*:\s*(-?\d+(?:\.\d+)?(?:\s*[,;]\s*-?\d+(?:\.\d+)?)+)\s*$/i))) calls.push({name:'statistics',args:[m[1]]});
  if ((m = text.match(/^(?:cek|validasi|check|validate)\s+(?:format\s+)?email\s*:?\s*(\S+)\s*$/i))) calls.push({name:'email',args:[m[1]]});
  if ((m = text.match(/^(?:konversi|convert|cek)\s+(?:warna|color)\s+(#[a-f0-9]{6})\b/i))) calls.push({name:'color',args:[m[1]]});
  return calls.slice(0,2);
}
export function convertUnit(value: number, from: string, to: string): number {
  from=from.toLowerCase();to=to.toLowerCase();
  if (!Number.isFinite(value) || Math.abs(value)>1e15) throw new Error('Nilai konversi tidak valid.');
  const units: Record<string,[string,number]>={m:['length',1],km:['length',1000],cm:['length',0.01],mm:['length',0.001],mi:['length',1609.344],ft:['length',0.3048],in:['length',0.0254],kg:['mass',1],g:['mass',0.001],mg:['mass',0.000001],lb:['mass',0.45359237],oz:['mass',0.028349523125]};
  if(['c','f','k'].includes(from)&&['c','f','k'].includes(to)) {
    const c=from==='f'?(value-32)*5/9:from==='k'?value-273.15:value;
    if(c < -273.15) throw new Error('Suhu di bawah nol absolut.');
    return to==='f'?c*9/5+32:to==='k'?c+273.15:c;
  }
  if(!units[from] || !units[to] || units[from][0]!==units[to][0]) throw new Error('Dimensi satuan berbeda.');
  return value*units[from][1]/units[to][1];
}
export function generatePassword(length=16,symbols=true): string {
  if(!Number.isInteger(length)||length<12||length>128) throw new Error('Panjang password harus 12–128 karakter.');
  const groups=['abcdefghijkmnopqrstuvwxyz','ABCDEFGHJKLMNPQRSTUVWXYZ','23456789',...(symbols?['!@#$%&*+-=?']:[])];
  const chars=groups.join('');const out=groups.map(g=>g[randomInt(g.length)]);
  while(out.length<length)out.push(chars[randomInt(chars.length)]);
  for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}
  return out.join('');
}
export async function runTools(text: string, signal?: AbortSignal): Promise<{ evidence: Evidence[]; directResponse?: string }> {
  const evidence: Evidence[]=[];
  for(const call of routeTools(text)) {
    signal?.throwIfAborted();
    const {name,args}=call;
    let source='AET deterministic tool'; let data: unknown;
    try {
      if(name==='password') {
        const password=generatePassword(Number(args[0]),Boolean(args[1]));
        return { evidence: [], directResponse: `Password acak (${password.length} karakter):\n\n\`\`\`text\n${password}\n\`\`\`\n\nDibuat dengan generator kriptografis di server.` };
      }
      if(name==='unit') data={value:Number(args[0]),from:args[1],to:args[2],result:convertUnit(Number(args[0]),args[1],args[2])};
      if(name==='statistics') {
        const values=args[0].split(/[,;]/).map(Number);if(values.length>1000||values.some(n=>!Number.isFinite(n)))throw new Error('Maksimal 1000 angka valid.');
        const sorted=[...values].sort((a,b)=>a-b);const n=values.length;
        data={count:n,sum:values.reduce((a,b)=>a+b,0),mean:values.reduce((a,b)=>a+b,0)/n,median:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,min:sorted[0],max:sorted[n-1]};
      }
      if(name==='email')data={email:args[0],syntaxValid:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args[0]),note:'Pemeriksaan format saja; tidak memeriksa keberadaan mailbox.'};
      if(name==='color')data={hex:args[0],rgb:[1,3,5].map(i=>parseInt(args[0].slice(i,i+2),16))};
      if(name==='web'){const r=await safeReadWeb(args[0].replace(/[.,;!]+$/, ''),0,signal);source=r.url;data=r.text;}
      if(name==='search') {
        source='https://api.tavily.com/search';
        if(!process.env.TAVILY_API_KEY)throw new Error('Pencarian web belum dikonfigurasi; referensi terbaru tidak dapat diverifikasi.');
        const r=await boundedJson(source,{signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:process.env.TAVILY_API_KEY,query:args[0],search_depth:'basic',max_results:3,include_answer:false})}) as {results?:{title:string;url:string;content:string}[]};
        if(!Array.isArray(r.results))throw new Error('Format hasil pencarian tidak valid.');
        data=r.results.slice(0,3).filter(r=>typeof r?.url==='string'&&typeof r.title==='string'&&typeof r.content==='string'&&/^https:\/\//.test(r.url)).map(r=>({title:r.title.slice(0,200),url:r.url,excerpt:r.content.slice(0,1500)}));
      }
      if(name==='currency') {
        source='https://api.frankfurter.app';
        const r=await boundedJson(`${source}/latest?amount=${args[0]}&from=${args[1].toUpperCase()}&to=${args[2].toUpperCase()}`,{signal}) as {date:string;rates:Record<string,number>};
        if(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(r.rates?.[args[2].toUpperCase()]))throw new Error('Mata uang atau kurs tidak tersedia.');
        data={date:r.date,amount:Number(args[0]),from:args[1].toUpperCase(),to:args[2].toUpperCase(),result:r.rates[args[2].toUpperCase()]};
      }
      if(name==='weather') {
        source='https://open-meteo.com';
        const geo=await boundedJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args[0])}&count=1&language=id`,{signal}) as {results?:{name:string;country:string;latitude:number;longitude:number}[]};
        const city=geo.results?.[0];if(!city||typeof city.name!=='string'||!Number.isFinite(city.latitude)||!Number.isFinite(city.longitude)||Math.abs(city.latitude)>90||Math.abs(city.longitude)>180)throw new Error('Kota tidak ditemukan.');
        const weather=await boundedJson(`https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=Asia%2FJakarta`,{signal});
        const current=(weather as {current?:{time?:string;temperature_2m?:number}})?.current;
        if(!current||typeof current.time!=='string'||!Number.isFinite(current.temperature_2m))throw new Error('Data cuaca saat ini tidak tersedia.');
        data={city:city.name,country:city.country,weather};
      }
      evidence.push({kind:name,source,status:'ok',data});
    }catch(error){signal?.throwIfAborted();evidence.push({kind:name,source,status:'error',data:{message:name==='password'||name==='unit' ? (error as Error).message : 'Tool gagal atau belum dikonfigurasi. Jangan mengarang hasil.'}});}
  }
  return { evidence };
}
