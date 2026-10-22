import mammoth from 'mammoth';
import { ApiError } from '../http.ts';
import { MAX_FILE_BYTES, validateImage } from '../files.ts';
export const MAX_EXTRACTED_CHARS = 24_000;
export type Attachment = { type: 'image' | 'file'; content: string; mimeType: string; fileName: string; extractedText?: string };
export function decodeDataUrl(value: string): { bytes: Buffer; mime: string } {
  const m = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!m || m[2].length % 4 !== 0) throw new ApiError(400, 'Data lampiran tidak valid.');
  const bytes = Buffer.from(m[2], 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new ApiError(413, 'Lampiran kosong atau melebihi 5 MB.');
  return { bytes, mime: m[1] };
}
function checkDocxZip(bytes: Buffer) {
  if (bytes.readUInt32LE(0) !== 0x04034b50) throw new ApiError(415, 'Dokumen DOCX tidak valid.');
  let expanded = 0, count = 0;
  for (let i = 0; i <= bytes.length - 46; i++) if (bytes.readUInt32LE(i) === 0x02014b50) {
    expanded += bytes.readUInt32LE(i + 24); count++;
    if (expanded > 20 * 1024 * 1024 || count > 3000) throw new ApiError(413, 'Isi dokumen terkompresi terlalu besar.');
    i += 45 + bytes.readUInt16LE(i + 28) + bytes.readUInt16LE(i + 30) + bytes.readUInt16LE(i + 32);
  }
  if (!count) throw new ApiError(415, 'Struktur DOCX rusak.');
}
export async function extractDocument(bytes: Buffer, mime: string): Promise<{ text: string; truncated: boolean }> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new ApiError(413, 'Dokumen harus berukuran 1 byte–5 MB.');
  let text = '';
  try {
    if (mime === 'application/pdf') {
      if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new ApiError(415, 'Isi file bukan PDF.');
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(bytes), isEvalSupported: false });
      try {
        const info = await parser.getInfo();
        if (info.total > 100) throw new ApiError(413, 'PDF maksimal 100 halaman.');
        text = (await parser.getText({ pageJoiner: '\n' })).text;
      } finally { await parser.destroy(); }
      if (text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, '').trim().length < 3) throw new ApiError(422, 'PDF tidak memiliki lapisan teks. Unggah versi teks atau lakukan OCR terlebih dahulu.');
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      if (bytes.length < 46) throw new ApiError(415, 'Dokumen DOCX rusak.');
      checkDocxZip(bytes);
      text = (await mammoth.extractRawText({ buffer: bytes })).value;
    } else if (mime === 'text/plain') {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (text.includes('\u0000')) throw new ApiError(415, 'TXT harus berupa teks UTF-8.');
    } else throw new ApiError(415, 'Gunakan PDF, DOCX, atau TXT.');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, 'Dokumen rusak, terenkripsi, atau tidak dapat diekstrak.');
  }
  if (!text.trim()) throw new ApiError(422, 'Dokumen tidak mengandung teks yang dapat dibaca.');
  return { text: text.trim().slice(0, MAX_EXTRACTED_CHARS), truncated: text.trim().length > MAX_EXTRACTED_CHARS };
}
export async function attachmentText(attachment: Attachment, allowImages = false): Promise<string | { url: string }> {
  if (!attachment.content) {
    return attachment.extractedText ? JSON.stringify({ document: attachment.fileName, untrusted_text: attachment.extractedText.slice(0, MAX_EXTRACTED_CHARS) }) : `[Lampiran lama ${attachment.fileName}: data tidak tersimpan. Minta unggah ulang jika diperlukan.]`;
  }
  const { bytes, mime } = decodeDataUrl(attachment.content);
  if (mime !== attachment.mimeType) throw new ApiError(415, 'Jenis lampiran tidak cocok.');
  if (attachment.type === 'image') {
    validateImage(bytes, mime);
    if (!allowImages) throw new ApiError(415, 'Analisis gambar belum terverifikasi untuk model ini. Kirim PDF/DOCX/TXT atau jelaskan isi gambar.', 'VISION_UNVERIFIED');
    return { url: attachment.content };
  }
  const result = await extractDocument(bytes, mime);
  return JSON.stringify({ document: attachment.fileName, untrusted_text: result.text, truncated: result.truncated });
}
