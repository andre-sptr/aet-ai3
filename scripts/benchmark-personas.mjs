import fs from 'node:fs/promises';
import { buildSystemPrompt } from '../lib/ai/personas/prompt-builder.ts';
import { routeTools, runTools } from '../lib/ai/tools.ts';
import { retrieveAetKnowledge } from '../lib/ai/knowledge.ts';
import { citationPolicyResponse } from '../lib/ai/citation-policy.ts';
if(process.env.AET_LIVE_TEST_APPROVED!=='true'||!process.env.SUMOPOD_API_KEY)throw new Error('An approved, provider-capped SUMOPOD_API_KEY is required.');
const key=process.env.SUMOPOD_API_KEY;
const budgetCapUsd=Number(process.env.AET_TEST_BUDGET_USD||1);
const maxTokens=Number(process.env.AET_BENCHMARK_MAX_TOKENS||384);
if(!Number.isFinite(budgetCapUsd)||budgetCapUsd<=0||!Number.isInteger(maxTokens)||maxTokens<64||maxTokens>2048)throw new Error('Invalid benchmark budget/output limit.');
const selected=process.env.AET_BENCHMARK_CASES?.split(',');
const cases=JSON.parse(await fs.readFile('tests/fixtures/benchmark-cases.json','utf8')).filter(c=>!selected||selected.includes(c.id));
const output=process.env.AET_TEST_REPORT || 'docs/benchmark-live-results.json';
const baseline=JSON.parse(await fs.readFile('tests/fixtures/baseline-prompts.json','utf8'));
const results=[];let writeQueue=Promise.resolve();let totalTokens=0;let requests=0;let stopped=false;
const fixedTime=new Date('2026-10-21T17:15:00Z');
async function execute(c,version,evidence){
  if(stopped||requests>=120||totalTokens>180_000)return;
  requests++;
  const system=version==='baseline'?baseline[c.mode]+(evidence.length?'\n<<<TOOL_DATA_START>>>\n'+JSON.stringify(evidence)+'\n<<<TOOL_DATA_END>>>':''):buildSystemPrompt(c.mode,c.prompt,evidence,fixedTime);
  const started=Date.now();const r={caseId:c.id,mode:c.mode,version,model:'gpt-4o-mini',maxTokens,systemCharacters:system.length,toolSelection:routeTools(c.prompt).map(t=>t.name)};
  try{
    const res=await fetch('https://ai.sumopod.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'system',content:system},...c.history,{role:'user',content:c.prompt}],max_tokens:maxTokens,stream:false}),signal:AbortSignal.timeout(25_000)});
    r.httpStatus=res.status;
    if(!res.ok){r.status='FAILED';if([401,402,403,429].includes(res.status))stopped=true;await res.body?.cancel();}
    else{const p=await res.json();r.output=p.choices?.[0]?.message?.content||'';r.finishReason=p.choices?.[0]?.finish_reason;r.usage=p.usage;r.status=r.output?'COMPLETED':'EMPTY';totalTokens+=p.usage?.total_tokens||0;}
  }catch(e){r.status='BLOCKED';r.error=e.name;}
  r.durationMs=Date.now()-started;results.push(r);
  writeQueue=writeQueue.then(()=>fs.writeFile(output,report()));await writeQueue;
  console.log(`${c.id} ${version}: ${r.status}`);
}
function report(){return JSON.stringify({checkedAt:new Date().toISOString(),budgetCapUsd,providerCapRequired:true,concurrency:2,automaticRetries:0,totalRequests:requests,totalTokens,stopped,scoreStatus:'Automated response capture only; see separate deterministic checks and manual rubric review.',results},null,2);}
// Same fixtures, model, generation cap, and timestamp for both versions.
for(const c of cases){
  if(stopped)break;
  let evidence=[];
  if(c.requiredTools.includes('search'))evidence=[{kind:'search',source:'controlled fixture',status:'error',data:'Pencarian tidak tersedia dalam pengujian ini.'}];
  else evidence=(await runTools(c.prompt)).evidence;
  evidence.push(...await retrieveAetKnowledge(c.prompt));
  await Promise.all([execute(c,'baseline',evidence),execute(c,'optimized',evidence)]);
  if(process.env.AET_BENCHMARK_PRODUCTION_POLICY==='true') {
    const direct=citationPolicyResponse(c.prompt);
    if(direct)results.push({caseId:c.id,mode:c.mode,version:'production-policy',model:'not called',status:'COMPLETED',output:direct,finishReason:'stop',usage:{total_tokens:0},responseOrigin:'deterministic-citation-policy'});
  }
}
await writeQueue;
await fs.writeFile(output,report());
console.log(JSON.stringify({requests,totalTokens,stopped}));
