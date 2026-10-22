import { assertPaidBudget, freshReportPath } from './benchmark-core.mjs';
await assertPaidBudget(AI_MODELS.map(model => model.id));
import fs from 'node:fs/promises';
import { AI_MODELS } from '../lib/ai-models.ts';
import { parseOpenAITextStream } from '../lib/sumopod.ts';
const key = process.env.SUMOPOD_API_KEY;
if (!key) throw new Error('SUMOPOD_API_KEY is required.');
if (process.env.AET_LIVE_TEST_APPROVED !== 'true') throw new Error('Set AET_LIVE_TEST_APPROVED=true after setting a provider spending cap.');
const out = await freshReportPath('model-verification');
const budgetCapUsd = Number(process.env.AET_TEST_BUDGET_USD || 3);
if (!Number.isFinite(budgetCapUsd) || budgetCapUsd <= 0) throw new Error('AET_TEST_BUDGET_USD must be a positive provider-enforced budget.');
const selected = process.env.AET_TEST_MODELS?.split(',');
const results=[];
for (const model of AI_MODELS.filter(model => !selected || selected.includes(model.id))) {
  const started=Date.now();
  const body={model:model.id,messages:[{role:'system',content:'Follow the user request precisely.'},{role:'user',content:'Reply only: AET OK'}],stream:true,...(model.id.startsWith('gpt-5')?{max_completion_tokens:512}:{max_tokens:model.id.startsWith('gemini/')?1024:64})};
  const result={model:model.id,parameters:Object.keys(body).filter(k=>!['model','messages','stream'].includes(k)),inputCharacters:86,maxOutputTokens:body.max_completion_tokens||body.max_tokens};
  try {
    const res=await fetch('https://ai.sumopod.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
    result.httpStatus=res.status;
    const raw=await res.text();
    if (!res.ok) {result.status='FAILED';result.error=raw.slice(0,500).replaceAll(key,'[REDACTED]');}
    else {
      let text='';let done=false;let finish;let reportedModel;let error=false;
      for(const frame of raw.split(/\r?\n\r?\n/)){
        const data=frame.split(/\r?\n/).filter(s=>s.startsWith('data:')).map(s=>s.slice(5).trim()).join('\n');
        if(data==='[DONE]'){done=true;continue;}
        if(!data)continue;
        try{const p=JSON.parse(data);reportedModel=p.model||reportedModel;text+=p.choices?.[0]?.delta?.content||'';finish=p.choices?.[0]?.finish_reason||finish;if(p.usage)result.usage=p.usage;if(p.error)error=true;}catch{error=true;}
      }
      let parsed='';
      try { for await (const delta of parseOpenAITextStream(new Response(raw),{expectedModel:model.id})) parsed+=delta; } catch { error=true; }
      result.status=reportedModel===model.id && text.trim()==='AET OK' && parsed===text && (done||finish==='stop') && !error ? 'PASS' : 'INCONCLUSIVE';
      result.reportedModel=reportedModel;result.output=text.slice(0,200);result.sseDone=done;result.finishReason=finish;
    }
  }catch(e){result.status='BLOCKED';result.error=e.name;}
  result.durationMs=Date.now()-started;results.push(result);
  await fs.writeFile(out,JSON.stringify({checkedAt:new Date().toISOString(),budgetCapUsd,providerCapRequired:true,concurrency:1,automaticRetries:0,requests:results.length,results},null,2));
  console.log(JSON.stringify(result));
  if ([401,402,403,429].includes(result.httpStatus)) break;
}
