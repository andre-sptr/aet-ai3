import { ApiError } from './http.ts';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export function detectImage(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | undefined {
  const b = Buffer.from(bytes);
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 16 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
}
export function validateImage(bytes: Uint8Array, declaredType?: string): string {
  if (bytes.length > MAX_FILE_BYTES) throw new ApiError(413, 'Gambar maksimal 5 MB.');
  const mime = detectImage(bytes);
  if (!mime || (declaredType && mime !== declaredType.split(';')[0])) throw new ApiError(415, 'Isi gambar harus sesuai format PNG, JPG, atau WebP.');
  return mime;
}
