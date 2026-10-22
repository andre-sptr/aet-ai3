import { ApiError, object } from './http.ts';
function text(data: Record<string, unknown>, key: string, max: number, required = false): string {
  const value = data[key];
  if (value === null || value === undefined) { if (required) throw new ApiError(400, `${key} wajib diisi.`); return ''; }
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || value.includes('\u0000')) throw new ApiError(400, `${key} tidak valid (maks. ${max} karakter).`);
  return value.trim();
}
export function safeUrl(value: string): string {
  if (!value) return '';
  try { const u = new URL(value); if (u.protocol === 'https:' && !u.username && !u.password) return u.href; } catch { /* invalid */ }
  throw new ApiError(400, 'Tautan harus berupa URL HTTPS yang valid.');
}
export function validateNews(input: unknown) {
  const d = object(input);
  const slug = text(d, 'slug', 160, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ApiError(400, 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.');
  if (d.published !== undefined && typeof d.published !== 'boolean') throw new ApiError(400, 'Status publikasi tidak valid.');
  return { title: text(d, 'title', 200, true), slug, content: text(d, 'content', 100_000, true), summary: text(d, 'summary', 1500), imageUrl: safeUrl(text(d, 'imageUrl', 2048)), published: d.published === true };
}
export function eventDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) throw new ApiError(400, 'Tanggal kegiatan tidak valid.');
  // datetime-local from older clients is interpreted explicitly as WIB.
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+07:00`;
  const day = value.slice(0, 10);
  const [year, month, date] = day.split('-').map(Number);
  if (new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10) !== day || +value.slice(11,13) > 23 || +value.slice(14,16) > 59) throw new ApiError(400, 'Tanggal kalender tidak valid.');
  const result = new Date(normalized);
  if (!Number.isFinite(result.getTime())) throw new ApiError(400, 'Tanggal kegiatan tidak valid.');
  return result;
}
export function validateEvent(input: unknown) {
  const d = object(input);
  const startDate = eventDate(d.startDate instanceof Date ? d.startDate.toISOString() : d.startDate);
  const endDate = d.endDate ? eventDate(d.endDate instanceof Date ? d.endDate.toISOString() : d.endDate) : null;
  if (endDate && endDate < startDate) throw new ApiError(400, 'Waktu selesai harus setelah waktu mulai.');
  return { title: text(d, 'title', 200, true), description: text(d, 'description', 100_000, true), location: text(d, 'location', 300), imageUrl: safeUrl(text(d, 'imageUrl', 2048)), startDate, endDate };
}
export function validateTeam(input: unknown) {
  const d = object(input);
  const order = typeof d.order === 'string' && /^\d+$/.test(d.order) ? Number(d.order) : d.order ?? 0;
  if (!Number.isSafeInteger(order) || Number(order) < 0 || Number(order) > 100_000) throw new ApiError(400, 'Urutan harus berupa bilangan bulat 0–100000.');
  const raw = text(d, 'socials', 5000);
  let socials: string | null = null;
  if (raw) {
    let parsed: Record<string, unknown>;
    try { parsed = object(JSON.parse(raw)); } catch { throw new ApiError(400, 'Socials harus berupa objek JSON nama platform dan URL.'); }
    if (Object.keys(parsed).length > 8) throw new ApiError(400, 'Maksimal 8 tautan sosial.');
    for (const [platform, url] of Object.entries(parsed)) if (!/^[a-zA-Z0-9 _-]{1,30}$/.test(platform) || typeof url !== 'string' || url.length > 2048) throw new ApiError(400, 'Tautan sosial tidak valid.'); else safeUrl(url);
    socials = JSON.stringify(parsed);
  }
  return { name: text(d, 'name', 150, true), position: text(d, 'position', 150, true), bio: text(d, 'bio', 5000), photoUrl: safeUrl(text(d, 'photoUrl', 2048)), order: Number(order), socials };
}
