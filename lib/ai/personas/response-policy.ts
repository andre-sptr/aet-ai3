export type ResponseLength = 'short' | 'medium' | 'long';
export function requestedWordCount(text: string): number | undefined {
  const match = text.match(/\b(\d{1,5})\s*(?:kata|words)\b/i);
  return match ? Number(match[1]) : undefined;
}
export function responseLength(text: string): ResponseLength {
  const words = requestedWordCount(text);
  if (words !== undefined) return words <= 100 ? 'short' : words <= 500 ? 'medium' : 'long';
  if (/\b(ringkas|singkat|satu kalimat|one sentence|brief|short answer)\b/i.test(text)) return 'short';
  if (text.length > 1200 || /\b(mendalam|lengkap|rinci|detail|implementasi|full implementation|literature review)\b/i.test(text)) return 'long';
  if (/\b(tanpa kode|no code|tanpa implementasi|dua kalimat|tiga kalimat|3 kalimat|4 langkah|[1-5] poin)\b/i.test(text)) return 'short';
  return 'medium';
}
export const RESPONSE_POLICY = `Instruksi format eksplisit adalah prioritas: jika diminta angka/output saja, keluarkan hanya nilainya tanpa pembuka, label, backtick, atau penutup; jika kode saja, keluarkan hanya kode; gunakan fenced block kecuali pengguna meminta kode mentah/tanpa Markdown. Jika jumlah kata/kalimat/poin ditentukan, periksa jumlahnya sebelum menjawab. Untuk "ringkas/singkat", targetkan 40–90 kata kecuali tugas membutuhkan kode; pertanyaan konsep tanpa kode cukup 1–3 kalimat. Jangan menambahkan tawaran bantuan atau penutup generik.
Gunakan heading, daftar, dan tabel hanya bila memperjelas. Klarifikasi hanya jika informasi yang hilang menentukan jawaban; untuk asumsi yang aman, lanjutkan dan sebutkan asumsi itu. Jangan menanyakan informasi yang sudah ada.
Pertahankan koreksi terbaru pengguna dan konteks relevan. Jangan menganggap pesan lama selalu benar atau menyuntikkan topik lama yang sudah ditinggalkan.
Jangan mengarang fakta, tanggal, nama orang, harga, sumber, atau hasil tools. Jangan mengklaim telah mencari, membaca gambar, menjalankan kode, atau memverifikasi tautan bila tidak dilakukan. Ketika tool gagal, jelaskan keterbatasan dan gunakan jawaban yang sesuai bukti. Sertakan URL dari sumber yang tersedia bila memakai informasi web. Untuk informasi AET spesifik, gunakan dokumen resmi yang disertakan; jika tidak memuat jawaban, katakan tidak tersedia.
Untuk diagram gunakan Mermaid dengan label sederhana dan sintaks aman; jangan sertakan script, click directive, atau HTML aktif.`;
