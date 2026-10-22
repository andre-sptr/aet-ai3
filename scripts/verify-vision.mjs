import fs from 'node:fs/promises';
import { buildSumopodChatRequest } from '../lib/sumopod.ts';
const key=process.env.SUMOPOD_API_KEY;
if(!key||process.env.AET_LIVE_TEST_APPROVED!=='true')throw new Error('Approved provider-capped API key required.');
const image='data:image/png;base64,'+(await fs.readFile('tests/fixtures/vision-colors.png')).toString('base64');
const results=[];
for(const model of ['gpt-4o-mini','gpt-4.1-mini']) {
  const started=Date.now();const row={model,test:'128x64 image: red left half, blue right half',expected:'RED BLUE'};
  try {
    const outbound=buildSumopodChatRequest({apiKey:key,modelId:model,stream:false,maxTokens:128,systemInstruction:'Follow the requested output format.',messages:[{role:'user',content:[{type:'text',text:'Identify the solid color on the left and on the right of this image. Reply with only the two English color names in that order, separated by a space.'},{type:'image_url',image_url:{url:image}}]}]});
    const response=await fetch(outbound.url,{...outbound.init,signal:AbortSignal.timeout(30000)});row.httpStatus=response.status;
    if(!response.ok){await response.body?.cancel();row.status='FAILED';}
    else {const data=await response.json();row.output=data.choices?.[0]?.message?.content||'';row.usage=data.usage;row.finishReason=data.choices?.[0]?.finish_reason;row.status=row.output.trim().toUpperCase()==='RED BLUE'&&row.finishReason==='stop'?'PASS':'INCONCLUSIVE';}
  }catch(e){row.status='BLOCKED';row.error=e.name;}
  row.durationMs=Date.now()-started;results.push(row);console.log(JSON.stringify(row));
}
await fs.writeFile('docs/vision-verification-current.json',JSON.stringify({checkedAt:new Date().toISOString(),budgetCapUsd:Number(process.env.AET_TEST_BUDGET_USD||1),concurrency:1,requests:results.length,scope:'Basic gateway image input smoke only; not an accuracy benchmark for arbitrary images.',results},null,2));
