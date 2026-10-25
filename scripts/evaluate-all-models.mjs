/** All-model gateway screening and production orchestration in ONE budget.
 * Defaults to PLAN_ONLY. Never shells out to independently budgeted runners. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { AI_MODELS } from '../lib/ai-models.ts';
import { buildSumopodChatRequest, parseOpenAITextStream, StreamFailure, DEFAULT_SUMOPOD_BASE_URL } from '../lib/sumopod.ts';
import { buildSystemPrompt } from '../lib/ai/personas/prompt-builder.ts';
import { createOrchestrator } from '../lib/ai/orchestration.ts';
import { validateChat } from '../lib/ai/context.ts';
import { calibrationSource } from '../lib/ai/calibration-source.ts';
import { evaluateApplicationOutput, evaluationMessages } from '../lib/ai/evaluation-checks.ts';
import { MODE_POLICIES } from '../lib/ai/mode-policy.ts';
import { runTools } from '../lib/ai/tools.ts';
import { gatewayErrorKind } from '../lib/ai/gateway-errors.ts';
import { loadBudgetGuard, loadPricing, estimateRequestCost, evaluateOutput, redact } from './benchmark-core.mjs';
import { assessScreening, screeningSummary, dimensionMarkdown, usageCost, usageState } from './benchmark-dimensions.mjs';
import { persistCheckpoint } from './benchmark-recovery.mjs';
import { BatchLedger, restoreBatch } from './batch-ledger.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const args=process.argv.slice(2), opts={};
for (let i=0;i<args.length;i++) {
  const flag=args[i];
  if (['--live','--mock','--plan','--diagnose-usage'].includes(flag)) opts[flag]=true;
  else if (['--profiles','--models','--application-models','--cases','--personas','--modes','--repeat','--screening-repeat','--application-repeat','--max-requests','--output-cap','--caps','--fixture','--out','--resume','--deadline-ms','--max-reported-tokens','--max-reserved-tokens'].includes(flag)
    && args[i+1] && !args[i+1].startsWith('--')) opts[flag]=args[++i];
  else throw new Error('Unknown or missing option: '+flag);
}
if ([opts['--live'],opts['--mock'],opts['--plan']].filter(Boolean).length>1) throw new Error('Choose one of --live, --mock, --plan.');
const mock=Boolean(opts['--mock']), planOnly=!opts['--live']&&!mock;
const list=(value,allowed) => {
  const values=value.split(',');
  if (!values.length || new Set(values).size!==values.length || values.some(v=>!allowed.includes(v))) throw new Error('Invalid or duplicate selection: '+value);
  return values;
};
const ids=AI_MODELS.map(m=>m.id);
const models=list(opts['--models']??ids.join(','),ids);
const appModels=list(opts['--application-models']??models.join(','),models);
const profiles=list(opts['--profiles']??'screening',['screening','application']);
const modes=list(opts['--modes']??'fast',['fast','normal','think']);
const personas=list(opts['--personas']??'daily,report,coding',['daily','report','coding']);
const repeat=Number(opts['--repeat']??3), maxRequests=Number(opts['--max-requests']??500), outputCap=Number(opts['--output-cap']??512);
const screeningRepeat=Number(opts['--screening-repeat']??repeat),applicationRepeat=Number(opts['--application-repeat']??repeat);
const batchDeadlineMs=Number(opts['--deadline-ms']??1_800_000), maxReportedTokens=Number(opts['--max-reported-tokens']??180000),maxReservedTokens=Number(opts['--max-reserved-tokens']??5_000_000);
if (!Number.isInteger(repeat)||repeat<1||repeat>10||!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>10000
  ||!Number.isInteger(outputCap)||outputCap<64||outputCap>4096) throw new Error('Invalid repeat/request/output cap.');
if([screeningRepeat,applicationRepeat].some(n=>!Number.isInteger(n)||n<1||n>10)
  ||!Number.isInteger(batchDeadlineMs)||batchDeadlineMs<1000||batchDeadlineMs>86_400_000
  ||[maxReportedTokens,maxReservedTokens].some(n=>!Number.isInteger(n)||n<1||n>100_000_000))throw new Error('Invalid repeat/time/token ceiling.');
const caps=opts['--caps']?JSON.parse(await fs.readFile(opts['--caps'],'utf8')):{};
if (!caps || typeof caps!=='object'||Array.isArray(caps)||Object.keys(caps).some(k=>!ids.includes(k))
  || Object.values(caps).some(v=>!Number.isInteger(v)||v<64||v>4096)) throw new Error('Caps must map exact model IDs to 64..4096.');
const screeningBytes=await fs.readFile('tests/fixtures/all-model-benchmark.json','utf8');
const appFixture=opts['--fixture']??'tests/fixtures/routing-retest-daily.json';
const appBytes=await fs.readFile(appFixture,'utf8');
const screeningCases=JSON.parse(screeningBytes), applicationCases=JSON.parse(appBytes);
const selectedCases=opts['--cases']?.split(',');
if(selectedCases && (new Set(selectedCases).size!==selectedCases.length || selectedCases.some(id=>![...screeningCases,...applicationCases].some(c=>c.id===id)))) throw new Error('Unknown or duplicate case ID.');
const source=await calibrationSource();
const previousBytes=opts['--resume']?await fs.readFile(opts['--resume'],'utf8'):null;
const previous=previousBytes?JSON.parse(previousBytes):null;
const checkedAt=previous?.checkedAt??new Date().toISOString();
if(!Number.isFinite(Date.parse(checkedAt)))throw new Error('Invalid original clock.');
const key=mock?'LOCAL_BATCH_FIXTURE':process.env.SUMOPOD_API_KEY??'';
const config={profiles,models,appModels,modes,personas,repeat,screeningRepeat,applicationRepeat,maxRequests,outputCap,caps,batchDeadlineMs,maxReportedTokens,maxReservedTokens,appFixture:appFixture.replaceAll('\\','/'),
  selectedCases:selectedCases??null,diagnoseUsage:Boolean(opts['--diagnose-usage']),
  screeningDatasetSha256:sha(JSON.stringify(screeningCases)),applicationDatasetSha256:sha(appBytes),...source};
const report={schemaVersion:1,kind:'combined-model-evaluation',sourceKind:planOnly?'PLAN_ONLY':mock?'LOCAL_MOCK':'live',planOnly,
  checkedAt,config,protocolSha256:sha(JSON.stringify(config)),keySha256:sha(key),maxRequests,
  modelRequests:0,reservedCostEstimateUsd:0,actualBilledCostUsd:null,attempts:[],results:[],circuit:null,
  reservedTokens:0,recordedTokens:0,maxReportedTokens,maxReservedTokens,deadlineAt:Date.parse(checkedAt)+batchDeadlineMs,
  unavailableModels:{},
  limitations:['Gateway screening and application samples are separate evidence kinds; no combined quality score.',
    'Application candidate injection applies to the answer role; planner/worker/verifier/revision still use server policy and are individually recorded.',
    'Frontier permission is checked for every application role. This operator suite does not grant access.',
    'External search/web/weather/currency tools are unavailable in this batch; tools and source-heavy scopes require separate evaluation.',
    'Usage diagnostics are opt-in A/B adapter probes only; they never expand the production allowlist automatically.',
    'Missing usage/cost stays null. Operator rates are not a provider invoice. Mock data does not establish model quality.',
    'Three repeats are an initial comparison, not stable tail-latency or universal model evidence. Human review remains required.']};
const eligible=c=>personas.includes(c.persona??c.mode)&&(!selectedCases||selectedCases.includes(c.id));
const row=(profile,model,c,variant,r)=>({sampleId:sha([profile,model,c.id,variant,r].join(':')).slice(0,32),profile,model,caseId:c.id,persona:c.persona??c.mode,
  category:c.category,variant,repeat:r,status:'NOT_RUN',attempted:false,answer:'',usage:null,usageBasedCostUsd:null,latencyMs:null,actualBilledCostUsd:null});
// Scenario-major paired waves; rotate model order across independent repeats.
for(let r=1;r<=Math.max(screeningRepeat,applicationRepeat);r++) {
  const rotated=[...models.slice((r-1)%models.length),...models.slice(0,(r-1)%models.length)];
  if(profiles.includes('screening')&&r<=screeningRepeat) for(const c of [...screeningCases].filter(eligible).sort((a,b)=>Number(b.id==='stream-smoke')-Number(a.id==='stream-smoke')))
    for(const model of rotated) report.results.push(row('screening',model,c,'gateway',r));
  if(profiles.includes('application')&&r<=applicationRepeat) for(const c of applicationCases.filter(eligible))for(const variant of modes)
    for(const model of rotated.filter(m=>appModels.includes(m))) report.results.push(row('application',model,c,variant,r));
}
if(opts['--diagnose-usage'])for(const model of models)for(const includeUsage of [false,true])report.results.push({
  ...row('usage-diagnostic',model,{id:includeUsage?'request-usage':'without-usage-option',mode:'daily',category:'telemetry'},'gateway',1),includeUsage});
if(!report.results.length)throw new Error('No samples selected.');
let guard=await loadBudgetGuard(),pricing=await loadPricing(process.env,[...new Set([...models,'gpt-4o-mini'])]);
if(mock){
  // Entirely local fixture rates, explicitly labeled. They are never written as
  // operator attestation or used to qualify a production policy.
  pricing={allowed:true,models:Object.fromEntries(ids.map(id=>[id,{inputUsdPerMillion:.1,outputUsdPerMillion:.5}]))};
  guard={allowed:true,hardLimitUsd:3,reason:'LOCAL_MOCK; no real provider cap asserted.'};
  Object.assign(process.env,{SUMOPOD_API_KEY:key,AET_PROVIDER_CALLS_PER_MINUTE:'10000',AET_ROUTING_MODE:'off'});
  delete process.env.AET_ROUTING_POLICY_FILE;delete process.env.AET_MAX_REQUEST_USD;delete process.env.AET_RUNTIME_PRICING_FILE;
}
report.budgetGuard=guard;report.pricing=pricing;
const root=path.resolve(opts['--out']??`evaluation/batch-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
await fs.mkdir(path.dirname(root),{recursive:true});await fs.mkdir(root);
let latestReport=path.join(root,'report.json');
const checkpoint=async()=>{const saved=await persistCheckpoint(path.join(root,'report.json'),redact(JSON.stringify(report,null,2),key));latestReport=saved.file;};
const ledger=new BatchLedger(report,{pricing,maxRequests,capUsd:guard.allowed?guard.hardLimitUsd*.8:0,checkpoint});
if(previous){report.resume=restoreBatch(previous,report,pricing);report.resume.sourceSha256=sha(previousBytes);}
function outboundFor(sample) {
  const diagnostic=sample.profile==='usage-diagnostic';
  const c=diagnostic?{mode:'daily',prompt:'Reply only: AET OK'}:screeningCases.find(c=>c.id===sample.caseId);
  const outbound=buildSumopodChatRequest({apiKey:key||'PLAN',baseUrl:DEFAULT_SUMOPOD_BASE_URL,modelId:sample.model,mode:c.mode,
    maxTokens:diagnostic?64:caps[sample.model]??outputCap,
    systemInstruction:buildSystemPrompt(c.mode,c.prompt,[],new Date(checkedAt),{imageInput:AI_MODELS.find(m=>m.id===sample.model).supportsImageInput===true}),messages:[...(c.history??[]),{role:'user',content:c.prompt}]});
  const body=JSON.parse(outbound.init.body);
  if(diagnostic){if(sample.includeUsage)body.stream_options={include_usage:true};else delete body.stream_options;}
  return body;
}
const plannedBodies=report.results.filter(r=>r.profile!=='application').map(outboundFor);
const gatewayEstimatedUsd=plannedBodies.map(b=>estimateRequestCost(b,pricing));
const maxAppAttempts=report.results.filter(r=>r.profile==='application').reduce((n,r)=>n+MODE_POLICIES[r.variant].maxAttempts,0);
// This is a deliberately conservative ceiling, not exact tokenization. Every
// model may be selected for an optional role only if its price is verified.
const rates=Object.values(pricing.models??{});
const appCeiling=pricing.allowed?report.results.filter(r=>r.profile==='application').reduce((n,r)=>{
  const p=MODE_POLICIES[r.variant], rate=pricing.models[r.model];
  // Fast can only call/retry the same answer candidate. Other modes may use
  // separately routed optional roles, so their ceiling uses all verified rates.
  const inputRate=r.variant==='fast'?rate.inputUsdPerMillion:Math.max(...rates.map(r=>r.inputUsdPerMillion));
  const outputRate=r.variant==='fast'?rate.outputUsdPerMillion:Math.max(...rates.map(r=>r.outputUsdPerMillion));
  return n+(p.inputTokens*inputRate+p.outputTokens*outputRate)/1e6;
},0):null;
report.plan={logicalSamples:report.results.length,gatewayCalls:plannedBodies.length,applicationAttemptCeiling:maxAppAttempts,
  batchDeadlineMs,maxReportedTokens,maxReservedTokens,
  maximumDispatches:Math.min(maxRequests,plannedBodies.length+maxAppAttempts),globalRequestCeiling:maxRequests,
  gatewayReservationEstimateUsd:gatewayEstimatedUsd.every(Boolean)?gatewayEstimatedUsd.reduce((n,c)=>n+c.estimatedCeilingUsd,0):null,
  applicationConservativeReservationCeilingUsd:appCeiling,
  localReservationCapUsd:guard.allowed?guard.hardLimitUsd*.8:null,
  actualOutputCaps:Object.fromEntries(models.map(id=>[id,JSON.parse(buildSumopodChatRequest({apiKey:'PLAN',modelId:id,maxTokens:caps[id]??outputCap,systemInstruction:'',messages:[]}).init.body)]).map(([id,b])=>[id,b.max_tokens??b.max_completion_tokens])),
  applicationOutputCaps:'Production persona/length policy; gateway --output-cap/--caps do not alter application output limits.',
  untested:['provider model authenticity','human persona quality','real billing','scopes not selected','HTTP endpoint transport (application profile calls server orchestrator directly)']};
let blocked=planOnly?'PLAN_ONLY; zero network.':!mock&&process.env.AET_LIVE_TEST_APPROVED!=='true'?'Explicit live approval is required.'
  :!key?'Missing server key.':!guard.allowed?guard.reason:!pricing.allowed?pricing.reason
  :!mock&&(process.env.SUMOPOD_BASE_URL??DEFAULT_SUMOPOD_BASE_URL).replace(/\/+$/,'')!==DEFAULT_SUMOPOD_BASE_URL?'Only the key-bound official gateway is permitted.':null;
if(previous&&!blocked&&!report.circuit){
  const claim=path.join(path.dirname(path.resolve(opts['--resume'])),`batch-resume-claim-${sha(previousBytes).slice(0,24)}.json`);
  await fs.writeFile(claim,JSON.stringify({continuation:root,startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
}
await checkpoint();
let currentSample,currentCase,session;
const fetcher=async(url,init)=>{
  const body=JSON.parse(init.body);
  // URL/credentials never come from report data or a client model field.
  if(url!==DEFAULT_SUMOPOD_BASE_URL+'/chat/completions')throw new Error('Unexpected gateway target.');
  const role=currentSample.profile==='application'?session?.budget.attempts.at(-1)?.role??'answer':currentSample.profile==='usage-diagnostic'?'usage-diagnostic':'answer';
  const attempt=await ledger.reserve(currentSample.sampleId,body,role);
  try {
    let response;
    if(mock){
      const system=body.messages[0].content;
      let answer=currentSample.profile==='usage-diagnostic'?'AET OK':currentCase.mockReference??currentCase.reference;
      if(system.includes('Buat rencana JSON saja'))answer=JSON.stringify({subgoals:currentCase.category==='comparison'?['Option A','Option B']:[],tools:[]});
      else if(system.includes('Kerjakan hanya subtujuan'))answer='{"conclusion":"LOCAL MOCK worker; no quality claim.","evidenceIds":[],"assumptions":[],"unresolved":[]}';
      else if(system.includes('Periksa draft'))answer='{"verdict":"pass","issues":[]}';
      if(currentSample.profile==='screening'&&currentCase.validator==='daily-format')answer='1. Aktifkan mode hemat daya dan turunkan kecerahan layar untuk menghemat baterai selama perjalanan.\n2. Hubungi keluarga seperlunya dan hindari aplikasi berat; daya tahan tetap bergantung kondisi perangkat.';
      if(currentSample.profile==='screening'&&currentCase.validator==='report-constraints')answer='Penelitian pada 120 siswa menemukan korelasi positif antara durasi belajar dan nilai ujian, dengan r = 0,42 dan p = 0,01. Hasil ini menunjukkan adanya asosiasi dalam sampel, tetapi desain potong lintang tidak membuktikan kausalitas atau arah hubungan. Kemampuan awal, dukungan keluarga, dan kebiasaan belajar merupakan potensi perancu yang belum dikendalikan. Karena informasi yang tersedia terbatas, interpretasi harus dibatasi pada hubungan statistik dan tidak menganggap durasi belajar menyebabkan peningkatan nilai.';
      response=new Response(`data: ${JSON.stringify({model:body.model,choices:[{delta:{content:answer},finish_reason:'stop'}]})}\n\ndata: ${JSON.stringify({choices:[],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
    }else response=await fetch(url,init);
    attempt.httpStatus=response.status;attempt.status='RESPONDED';
    if([401,402,403,429].includes(response.status))report.circuit=`Shared provider HTTP ${response.status}; no rotation or automatic continuation.`;
    await ledger.serial(checkpoint);
    return response;
  }catch(error){attempt.status='TRANSPORT_ERROR';report.circuit='Transport or dispatch-checkpoint failure; no rotation.';await ledger.serial(checkpoint);throw error;}
};
const evaluationTools=async(text,signal,options={})=>{
  const calls=options.calls??[];
  if(calls.some(c=>['search','web','weather','currency'].includes(c.name)))return {evidence:calls.map(c=>{
    options.beforeCall?.();return {kind:c.name,source:'batch-disabled-external-tool',status:'error',data:'External source tools are unavailable in this evaluation.'};
  })};
  return runTools(text,signal,options);
};
for(const sample of report.results){
  if(sample.attempted)continue; // Includes failed and uncertain in-flight samples.
  if(blocked||report.circuit||report.unavailableModels[sample.model]){if(!planOnly){sample.status='BLOCKED';sample.reason=blocked??report.circuit??report.unavailableModels[sample.model];}continue;}
  currentSample=sample;session=undefined;
  currentCase=(sample.profile==='application'?applicationCases:screeningCases).find(c=>c.id===sample.caseId);
  sample.attempted=true;sample.status='DISPATCHING';await ledger.serial(checkpoint);
  const started=Date.now(),remaining=report.deadlineAt-Date.now();
  if(remaining<=0){report.circuit='Global batch deadline reached.';sample.status='BLOCKED';await ledger.serial(checkpoint);continue;}
  const signal=AbortSignal.timeout(Math.min(remaining,sample.profile==='application'?55_000:45_000));
  try {
    if(sample.profile==='application'){
      const input=validateChat({mode:currentCase.persona,responseMode:sample.variant,messages:evaluationMessages(currentCase),frontierAccessToken:process.env.AET_EVALUATION_FRONTIER_TOKEN});
      session=await createOrchestrator(input,{signal,fetcher,rates:pricing.models,evaluationCandidate:sample.model,toolRunner:evaluationTools});
      sample.stages=[];
      const result=await session.run(e=>{if(e.event==='status')sample.stages.push(e.data.stage);});
      Object.assign(sample,evaluateApplicationOutput(currentCase,result.answer),{answer:result.answer,telemetry:result.telemetry,metadata:result.metadata,
        usage:result.telemetry.usage,usageBasedCostUsd:result.telemetry.usageBasedCostUsd});
      sample.status=sample.objectiveStatus;
    }else{
      const body=outboundFor(sample);sample.request={url:DEFAULT_SUMOPOD_BASE_URL+'/chat/completions',body};
      const response=await fetcher(sample.request.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal,redirect:'error',cache:'no-store'});
      sample.httpStatus=response.status;sample.finishReason=null;sample.reportedModel=null;sample.output='';
      if(!response.ok){
        await response.body?.cancel();
        if([400,404,422].includes(response.status))report.unavailableModels[sample.model]='Exact model/request rejected; no automatic retry in this batch.';
        throw Object.assign(new Error('Provider HTTP '+response.status),{code:'UPSTREAM_'+gatewayErrorKind(response.status).toUpperCase()});
      }
      if(!response.headers.get('content-type')?.includes('text/event-stream')){await response.body?.cancel();throw new StreamFailure('Expected SSE.');}
      for await(const delta of parseOpenAITextStream(response,{expectedModel:sample.model,signal,readUsageAfterStop:true,onMetadata:m=>{
        if(m.model)sample.reportedModel=m.model;if(m.finishReason)sample.finishReason=m.finishReason;
        if(m.usage&&Object.keys(m.usage).length)sample.usage={...sample.usage,...m.usage};if(m.drainOutcome)sample.metadataDrain=m.drainOutcome;
      }})){sample.output+=delta;if(sample.output.length>64000)throw new StreamFailure('Output exceeds bound.','STREAM_LIMIT');}
      if(sample.profile==='screening'){
        Object.assign(sample,evaluateOutput(currentCase,sample.output));
        sample.status=sample.reportedModel!==sample.model?'INCONCLUSIVE':sample.objectiveStatus==='FAIL'?'FAIL':sample.qualitativeReview==='REQUIRED'?'INCONCLUSIVE':'PASS';
      }else sample.status=usageState(sample).known?'USAGE_CAPTURED':'USAGE_MISSING';
    }
  }catch(error){
    sample.status='ERROR';sample.errorCode=error instanceof StreamFailure?error.code:error.code??(signal.aborted?'UPSTREAM_TIMEOUT':'EVALUATION_ERROR');
    sample.error=redact(error.message,key);
  }finally{
    sample.latencyMs=Date.now()-started;
    if(session){sample.telemetry=session.budget.snapshot();sample.usage=sample.telemetry.usage;sample.usageBasedCostUsd=sample.telemetry.usageBasedCostUsd;}
    if(sample.profile!=='application'){
      sample.durationMs=sample.latencyMs;sample.usageUnknownReason=usageState(sample).reason;sample.usageBasedCostUsd=usageCost(sample,pricing);
      if(sample.profile==='screening')sample.dimensions=assessScreening(currentCase,sample);
    }
    const attempts=report.attempts.filter(a=>a.sampleId===sample.sampleId);
    attempts.forEach((a,i)=>{a.usage=sample.profile==='application'?sample.telemetry?.attempts[i]?.usage??null:sample.usage;});
    report.recordedTokens=report.attempts.reduce((n,a)=>n+(a.usage?.total_tokens??((a.usage?.prompt_tokens??0)+(a.usage?.completion_tokens??0))),0);
    sample.providerRequests=attempts.map(a=>({body:a.body,httpStatus:a.httpStatus}));
    await ledger.serial(checkpoint);
  }
}
const screeningReport={models:models.map(id=>({id})),pricing,results:report.results.filter(r=>r.profile==='screening')};
report.screeningSummary=screeningSummary(screeningReport,screeningCases);
report.status=planOnly?'PLAN_ONLY':report.results.every(r=>r.status==='BLOCKED')?'BLOCKED':report.results.some(r=>['ERROR','FAIL','DISPATCHING'].includes(r.status))?'HAS_FAILURES':'REVIEW_REQUIRED';
report.finishedAt=new Date().toISOString();
const costs=report.results.map(r=>r.usageBasedCostUsd).filter(c=>c!==null);
report.costCoverage={knownSamples:costs.length,attemptedSamples:report.results.filter(r=>r.attempted).length,knownSubtotalUsd:costs.length?costs.reduce((a,b)=>a+b,0):null,totalUsageBasedUsd:null,actualBilledUsd:null};
const knownAttempts=report.results.flatMap(r=>r.telemetry?.attempts??[]).filter(a=>a.usageBasedCostUsd!==null);
report.costCoverage.applicationKnownAttemptSubtotalUsd=knownAttempts.length?knownAttempts.reduce((n,a)=>n+a.usageBasedCostUsd,0):null;
const measuredAttempts=report.attempts.map(a=>usageCost({...a,attempted:true,request:{body:a.body}},pricing)).filter(c=>c!==null);
report.attemptCostCoverage={known:measuredAttempts.length,attempted:report.modelRequests,unknown:report.modelRequests-measuredAttempts.length,
  knownUsageCostSubtotalUsd:measuredAttempts.length?measuredAttempts.reduce((a,b)=>a+b,0):null,
  totalUsageBasedCostUsd:measuredAttempts.length===report.modelRequests&&measuredAttempts.length?measuredAttempts.reduce((a,b)=>a+b,0):null,actualBilledUsd:null};
// Compatible application subreports keep their real kind and current fingerprint.
// The parent itself can never be loaded as an application calibration report.
report.applicationReports=[];
if(!planOnly&&profiles.includes('application'))for(const model of appModels){
  const results=report.results.filter(r=>r.profile==='application'&&r.model===model);
  const relative='application-'+ids.indexOf(model)+'.json';
  const subreport={schemaVersion:2,kind:'application-evaluation',candidateModelId:model,datasetRef:config.appFixture,
    checkedAt,finishedAt:report.finishedAt,...source,sourceKind:report.sourceKind,planOnly:false,
    datasetSha256:sha(appBytes),repeats:applicationRepeat,pricing,budgetGuard:guard,results,
    globalBudget:{parentProtocolSha256:report.protocolSha256,maxRequests,modelRequests:report.modelRequests,reservedCostEstimateUsd:report.reservedCostEstimateUsd},
    actualBilledCostUsd:null,caveats:report.limitations};
  await fs.writeFile(path.join(root,relative),redact(JSON.stringify(subreport,null,2),key),{flag:'wx'});
  report.applicationReports.push({model,ref:path.relative(process.cwd(),path.join(root,relative)).split(path.sep).join('/')});
}
await ledger.serial(checkpoint);
const summary=['# AET AI — combined model evaluation','',`Source: **${report.sourceKind}**. Status: **${report.status}**. Dispatched: ${report.modelRequests}/${maxRequests}.`,
  `Logical samples: ${report.plan.logicalSamples}. Maximum application attempts: ${maxAppAttempts}. Gateway estimate USD: ${report.plan.gatewayReservationEstimateUsd??'null'}. Application ceiling USD: ${appCeiling??'null'}.`,
  `Reserved USD: ${report.reservedCostEstimateUsd}. Actual billed USD: null. Shared circuit: ${report.circuit??'closed'}.`, '',dimensionMarkdown(report.screeningSummary),
  '| Profile | Model | Case | Mode | Repeat | Status | Error | Usage cost USD |','| --- | --- | --- | --- | ---: | --- | --- | ---: |',
  ...report.results.map(r=>`| ${r.profile} | ${r.model} | ${r.caseId} | ${r.variant} | ${r.repeat} | ${r.status} | ${r.errorCode??''} | ${r.usageBasedCostUsd??'null'} |`),'',...report.limitations.map(l=>'- '+l),''];
await fs.writeFile(path.join(root,'summary.md'),redact(summary.join('\n'),key),{flag:'wx'});
const csv=value=>'"'+(/^[=+\-@]/.test(String(value??''))?"'":'')+String(value??'').replaceAll('"','""')+'"';
await fs.writeFile(path.join(root,'review.csv'),[['sample_id','case_id','repeat','answer','instructions_0_5','accuracy_0_5','source_support_0_5','notes'],
  ...report.results.filter(r=>r.answer||r.output).map(r=>[r.sampleId,r.caseId,r.repeat,r.answer||r.output,'','','',''])].map(r=>r.map(csv).join(',')).join('\n'),{flag:'wx'});
console.log(JSON.stringify({status:report.status,report:latestReport,summary:path.join(root,'summary.md'),modelRequests:report.modelRequests,plan:report.plan}));
if(!planOnly&&report.status!=='REVIEW_REQUIRED')process.exitCode=2;
