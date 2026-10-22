/** Narrow, deterministic responses for tasks that must never invent publication identifiers. */
export function citationPolicyResponse(text: string): string | undefined {
  if (/```/.test(text) || /\b(?:kode|program|script|regex|API)\b/i.test(text)) return;
  if (/\bAPA\s*7?\b/i.test(text) && /\bplaceholder\b/i.test(text) && /\b(?:artikel|jurnal|journal)\b/i.test(text)) {
    return 'Contoh format APA 7 dengan placeholder (bukan referensi publikasi nyata):\n\n[Penulis], [Inisial]. ([Tahun]). [Judul artikel]. *[Nama Jurnal], [Volume]*([Nomor]), [Halaman]. [DOI atau URL terverifikasi]\n\nGanti setiap placeholder hanya dengan metadata publikasi yang sudah diperiksa. Jika artikel tidak memiliki DOI, hilangkan bagian DOI sesuai ketentuan sumber yang digunakan.';
  }
  if (/\b(?:buat(?:kan)?|bikin|karang|ciptakan|generate|invent|make|create)\b.{0,40}\bDOI\b/i.test(text) && !/\b10\.\d{4,9}\/\S+/i.test(text)) {
    return 'DOI tidak dapat dibuat atau ditebak dari judul, penulis, dan tahun. DOI ditetapkan melalui penerbit atau lembaga registrasi. Gunakan [DOI belum diverifikasi] sampai metadata publikasi diperiksa pada penerbit atau registrasi DOI. Jika artikel memang tidak memiliki DOI, jangan menambahkannya.';
  }
}
