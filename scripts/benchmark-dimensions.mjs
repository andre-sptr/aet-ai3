/** Additive rubric. Legacy evaluateOutput/checks/status are never rewritten. */
import { isDeepStrictEqual } from 'node:util';
import { outputContract, checkOutputContract } from '../lib/ai/output-contract.ts';
import { evaluateOutput } from './benchmark-core.mjs';

export const DIMENSION_RUBRIC_VERSION = 'screening-dimensions-v1';
const assignments = text => {
  const pairs=text.trim().split(';').map(s=>s.trim().match(/^([\p{L}\w-]+)\s*=\s*([^;=\n]+)$/u));
  return pairs.every(Boolean)&&new Set(pairs.map(p=>p[1])).size===pairs.length ? Object.fromEntries(pairs.map(p=>[p[1],p[2].trim()])) : null;
};
const fenced = text => text.trim().match(/^```(?:json|javascript|js)?\s*\n([\s\S]*?)\n```$/i)?.[1] ?? text;
const verdict = value => value === null ? 'UNMEASURED' : value ? 'PASS' : 'FAIL';
export function assessScreening(c, row) {
  const complete = row.finishReason === 'stop' && row.httpStatus === 200 && !row.error;
  const legacy = complete ? evaluateOutput(c, row.output ?? '') : null;
  const text = row.output ?? '', inner = fenced(text);
  let content = null, format = null;
  if (complete) {
    const explicit = outputContract(c.prompt);
    format = checkOutputContract(text, explicit).pass;
    if (c.validator === 'uncertainty-json') {
      try {
        content = isDeepStrictEqual(JSON.parse(inner), JSON.parse(c.reference));
      } catch { content = null; } // Invalid syntax cannot prove semantic falsity.
      if (format === null) { try { JSON.parse(text); format = true; } catch { format = false; } }
    } else if (c.validator === 'exact') {
      if (/^-?\d+$/.test(c.reference)) {
        const numeric = text.trim().replace(/^Rp\s*/i, '');
        content = /^-?\d+$/.test(numeric) ? BigInt(numeric) === BigInt(c.reference) : null;
      } else {
        const expected=assignments(c.reference), actual=assignments(text);
        if(expected){
          content=actual?isDeepStrictEqual(actual,expected):null;
          format=Boolean(actual&&Object.keys(actual).join(';')===Object.keys(expected).join(';'));
        }else content = text.trim() === c.reference;
      }
    } else if (c.validator === 'safe-last-function') {
      content = evaluateOutput(c, inner).objectiveStatus === 'PASS';
    } else if (c.validator === 'daily-format') {
      format = legacy.checks.every(c => c.pass);
    } else if (c.validator === 'report-constraints') {
      format = legacy.checks.slice(0, 2).every(c => c.pass);
      // Keywords are a narrow content check, never a persona-quality score.
      content = legacy.checks.slice(2).every(c => c.pass);
    }
  }
  return {
    rubricVersion: DIMENSION_RUBRIC_VERSION,
    technical: !row.attempted ? 'NOT_RUN' : complete && row.reportedModel === row.model ? 'PASS'
      : complete && !row.reportedModel ? 'UNMEASURED' : 'FAIL',
    completeness: !row.attempted ? 'NOT_RUN' : row.finishReason === 'length' ? 'TRUNCATED' : complete ? 'COMPLETE' : 'INCOMPLETE',
    content: verdict(content), format: verdict(format),
    instructions: verdict(format),
    reviewPending: Boolean(legacy?.qualitativeReview === 'REQUIRED'),
    historicalObjectiveStatus: row.objectiveStatus ?? null,
    caveat: 'Content checks are narrow; UNMEASURED is not a failure. Instructions measure only the explicit format/shape checks; broader instruction/persona quality needs human review. Historical checks remain separate.',
  };
}
export function usageState(row) {
  const u = row.usage, known = Number.isSafeInteger(u?.prompt_tokens) && u.prompt_tokens >= 0
    && Number.isSafeInteger(u?.completion_tokens) && u.completion_tokens >= 0;
  if (known) return { known, reason: null };
  if (u && Object.keys(u).length) return { known, reason: 'partial_usage' };
  if (!row.attempted) return { known, reason: 'not_attempted' };
  if (row.request?.body?.stream_options?.include_usage !== true) return { known, reason: 'not_requested' };
  if (row.metadataDrain === 'done') return { known, reason: 'not_sent' };
  if (row.metadataDrain === 'eof') return { known, reason: 'not_observed_before_eof' };
  if (['time_limit','byte_limit','not_requested'].includes(row.metadataDrain)) return { known, reason: 'reading_ended_early' };
  if (row.finishReason === 'length' && !row.metadataDrain) return { known, reason: 'historical_parser_ended_at_length' };
  return { known, reason: 'not_observed' };
}
export function usageCost(row, pricing) {
  if (!usageState(row).known) return null;
  const rate = pricing?.models?.[row.model];
  if (!rate || ![rate.inputUsdPerMillion,rate.outputUsdPerMillion].every(n => Number.isFinite(n) && n >= 0)) return null;
  return (row.usage.prompt_tokens * rate.inputUsdPerMillion + row.usage.completion_tokens * rate.outputUsdPerMillion) / 1e6;
}
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), n = sorted.length;
  return n % 2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2;
};
export function screeningSummary(report, cases) {
  return report.models.map(model => {
    const rows = report.results.filter(r => r.model === model.id);
    const dimensions = rows.map(r => assessScreening(cases.find(c => c.id === r.caseId),r));
    const costs = rows.map(r => usageCost(r,report.pricing)).filter(c => c !== null);
    const latencies = rows.filter((r,i) => dimensions[i].completeness === 'COMPLETE' && Number.isFinite(r.durationMs)).map(r => r.durationMs).sort((a,b) => a-b);
    const measured = dimension => dimensions.filter(d => ['PASS','FAIL'].includes(d[dimension]));
    return { model: model.id, planned: rows.length, attempted: rows.filter(r => r.attempted).length,
      technicalPass: dimensions.filter(d => d.technical === 'PASS').length,
      historicalObjectivePass: rows.filter(r => r.objectiveStatus === 'PASS').length,
      historicalObjectiveFail: rows.filter(r => r.objectiveStatus === 'FAIL').length,
      content: { measured: measured('content').length, passed: measured('content').filter(d => d.content === 'PASS').length },
      format: { measured: measured('format').length, passed: measured('format').filter(d => d.format === 'PASS').length },
      truncated: dimensions.filter(d => d.completeness === 'TRUNCATED').length,
      reviewPending: dimensions.filter(d => d.reviewPending).length,
      latency: { n: latencies.length, medianMs: median(latencies), p95Ms: latencies.length ? latencies[Math.ceil(.95*latencies.length)-1] : null,
        definition: 'Total request duration for complete responses; median averages two central values; p95 uses nearest rank. Not TTFT.' },
      usage: { known: rows.filter(r => usageState(r).known).length, attempted: rows.filter(r => r.attempted).length },
      cost: { known: costs.length, attempted: rows.filter(r => r.attempted).length, knownSubtotalUsd: costs.length ? costs.reduce((a,b) => a+b,0) : null,
        completeUsageBasedTotalUsd: costs.length === rows.filter(r => r.attempted).length && costs.length ? costs.reduce((a,b) => a+b,0) : null, actualBilledUsd: null },
    };
  });
}
export function dimensionMarkdown(summary) {
  return ['## Dimensi terpisah (screening-dimensions-v1)', '',
    '| Model | Teknis | Isi lulus/diukur | Format lulus/diukur | Terpotong | Review | Median/p95 ms (n) | Usage diketahui/attempt | Subtotal usage USD |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |',
    ...summary.map(s => `| ${s.model} | ${s.technicalPass}/${s.attempted} | ${s.content.passed}/${s.content.measured} | ${s.format.passed}/${s.format.measured} | ${s.truncated} | ${s.reviewPending} | ${s.latency.medianMs ?? '—'}/${s.latency.p95Ms ?? '—'} (${s.latency.n}) | ${s.usage.known}/${s.usage.attempted} | ${s.cost.knownSubtotalUsd ?? 'null'} |`), '',
    'Isi hanya mencakup cek yang dapat diukur. Terpotong tidak dinilai salah isi. Median/p95 adalah durasi total respons lengkap, bukan TTFT; p95 nearest rank. Subtotal biaya hanya mencakup usage yang diketahui × tarif operator; tagihan dan biaya request yang tidak diketahui tetap null. Hasil ini bukan evaluasi routing aplikasi atau ranking universal.', ''].join('\n');
}
