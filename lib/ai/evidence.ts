import type { ChatSource } from '../../types/index.ts';
import type { Evidence } from './personas/prompt-builder.ts';

const names: Record<string, string> = {
  web: 'Halaman web', search: 'Pencarian web', weather: 'Cuaca', currency: 'Kurs mata uang',
  unit: 'Konversi satuan', statistics: 'Perhitungan statistik', email: 'Pemeriksaan format email',
  color: 'Konversi warna', 'aet-knowledge': 'Dokumen resmi AET PCR',
};
function publicUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return;
  try { const u = new URL(value); if (u.protocol === 'https:' && !u.username && !u.password) return u.href; } catch { /* no link */ }
}
/** Provenance is derived from executed tools, never from model-generated links. */
export function evidenceSources(evidence: Evidence[]): ChatSource[] {
  return evidence.flatMap(e => {
    if (e.kind === 'search' && e.status === 'ok' && Array.isArray(e.data)) {
      return e.data.slice(0, 3).flatMap(item => {
        const url = publicUrl(item?.url);
        return url ? [{ kind: e.kind, source: url, status: e.status, title: String(item.title || 'Hasil pencarian').slice(0, 200), url }] : [];
      });
    }
    return [{ kind: e.kind, source: e.source.slice(0, 2048), status: e.status, title: names[e.kind] || e.kind, url: publicUrl(e.source) }];
  }).slice(0, 10);
}
