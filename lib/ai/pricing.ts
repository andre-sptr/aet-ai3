import { readFile, stat } from 'node:fs/promises';
import { ApiError } from '../http.ts';
import type { Rates } from './budget.ts';
export function validatePricing(pricing: {verifiedAt?:string;sourceUrl?:string;operatorVerified?:boolean;models?:Rates} | undefined, modelIds: string[], now = Date.now()) {
  const checked = Date.parse(pricing?.verifiedAt ?? '');
  let official = false;
  try { const u = new URL(pricing?.sourceUrl ?? ''); official = u.protocol === 'https:' && ['sumopod.com','ai.sumopod.com','docs.sumopod.com'].includes(u.hostname) && !u.username && !u.password; } catch { /* fail closed */ }
  if (!official || pricing?.operatorVerified !== true || !Number.isFinite(checked) || checked > now || now - checked > 86_400_000
    || modelIds.some(id => ![pricing?.models?.[id]?.inputUsdPerMillion,pricing?.models?.[id]?.outputUsdPerMillion].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0))) return {allowed:false as const,reason:'Recent official gateway input/output rates for every exact model ID have not been verified.'};
  return { ...pricing, allowed:true as const, models:pricing.models ?? {} };
}
export async function serverRates(): Promise<Rates> {
  const file = process.env.AET_RUNTIME_PRICING_FILE;
  if (!file) return {};
  try {
    if ((await stat(file)).size > 64_000) throw new Error('oversized');
    const value = JSON.parse(await readFile(file,'utf8'));
    if (!value.models || typeof value.models !== 'object' || Array.isArray(value.models)) throw new Error('invalid');
    const result = validatePricing(value,Object.keys(value.models));
    if (!result.allowed) throw new Error('unverified');
    return result.models;
  } catch { throw new ApiError(503,'Tarif runtime belum valid atau kedaluwarsa. Perbarui konfigurasi operator.','PRICING_CONFIG'); }
}
