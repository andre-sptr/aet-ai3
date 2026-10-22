## Pemeriksaan ulang 2.1.1

77 unit tests, 84 HTTP checks dan 9 integrasi live aplikasi telah dijalankan. Pengamanan autentikasi, origin, draft, CRUD, SSRF dan upload pada baseline dipertahankan. Perubahan tambahan membatasi teks setelah ekstraksi, membatasi empat gambar terbaru, meneruskan abort ke layanan eksternal, dan mencegah respons SSE diteruskan setelah done.

`evidenceSources` hanya membuat provenance dari hasil tools server. Output dokumen/web/gambar tetap data tidak tepercaya. Respons terkontrol untuk contoh APA berplaceholder dan pembuatan DOI mengurangi dua failure patterns yang terbukti; referensi lain tetap tidak dijamin valid secara otomatis.

Tidak ada dependency baru atau upgrade major. Audit ulang tetap mencatat 10 paket terdampak (5 high development, 5 moderate, 0 critical), termasuk 3 moderate pada dependency produksi DOCX. Tidak menggunakan audit fix --force atau downgrade framework. File key hanya dibaca dari environment proses dan tidak ada key nyata dalam source/ZIP. Batas USD 3 berasal dari otorisasi serta cap key yang dinyatakan pengguna; aplikasi tidak mengklaim mengetahui tagihan aktual.

Browser final diblokir kebijakan URL; tidak ada klaim pentest/QA visual menyeluruh. Limiter per-process, pencabutan sesi individual, isolasi parser, distributed limiter dan verifikasi Blob produksi tetap memiliki batas seperti catatan berikut.

---

# Security audit 2.1

## Diperbaiki dan diuji

- Sesi admin HMAC-SHA256, lifetime 24 jam, random ID, pemeriksaan signature/purpose/waktu; cookie HttpOnly, SameSite=Strict, Secure pada produksi. Tidak ada login default.
- Mutasi berita/kegiatan/tim/upload dan logout diperiksa server; cookie palsu, signature rusak, dan token Frontier sebagai token admin ditolak.
- Secret admin dan Frontier minimal 32 karakter; tidak ada fallback secret publik. APP_ORIGIN wajib pada produksi. Permintaan cross-site/origin berbeda ditolak.
- Login 5 percobaan/15 menit; chat 12/menit per client key, 100/jam global default, maksimal 4 aktif per proses. Frontier memerlukan token, enable flag, 8/hari per key dan 20/hari global.
- IP forwarding hanya dipercaya dengan TRUST_PROXY=true. Tanpanya, request memakai satu bucket konservatif bersama. Pengelola wajib memastikan proxy menimpa header tersebut.
- Public API/detail berita tidak membocorkan draft. Validasi slug dan unik, link HTTPS, MIME/signature upload, body limit, serta error generik mencegah kebocoran detail upstream.
- Scraping: HTTPS port 443 tanpa userinfo, DNS seluruh address harus publik, TLS ke IP tervalidasi, redirect divalidasi ulang, batas waktu 5 detik per hop dan 256 KB, output 6.000 karakter. Password memakai node:crypto.
- Dokumen dan hasil tools dibingkai sebagai data tidak tepercaya; client tidak boleh menyisipkan role system. Perlindungan prompt injection adalah mitigasi dan tidak menjamin perilaku model sempurna.
- Endpoint/harness QA temporer dikeluarkan dari source akhir. Test gateway loopback hanya diizinkan melalui flag khusus dan bukan konfigurasi produksi.

## Dependency

Versi final memakai Next.js 16.4.2, React/React DOM 19.3.1; paket kompatibel diperbarui lewat lockfile. KaTeX dipatok 0.18.2 dan override menyatukan versi turunannya untuk perbaikan advisory pada 0.18.1 ke bawah. Ini perubahan terbatas, bukan upgrade major framework massal.

Audit final: lihat `dependency-audit.json` dan ringkasan dalam laporan regresi. Advisory yang belum mempunyai perbaikan kompatibel tidak dihilangkan melalui downgrade framework atau `npm audit fix --force`.

- **braces → micromatch → fast-glob → eslint plugin/config**: high, jalur tooling development. Input glob berasal dari konfigurasi proyek; tidak diekspos sebagai API pengguna. Upgrade lint toolchain saat perbaikan kompatibel tersedia.
- **postcss-selector-parser → @tailwindcss/typography**: moderate, build-time CSS. Tidak digunakan sebagai parser CSS publik.
- **sprintf-js → argparse → mammoth**: moderate, jalur runtime DOCX. Pemanggilan yang terdaftar berasal dari CLI parsing pada dependency; aplikasi memakai extractRawText. Ini analisis keterjangkauan kode, bukan bukti bahwa dependency sepenuhnya aman.

Detail versi, severity, dan advisory URL tersimpan di JSON audit. Tidak ada temuan critical pada audit final. Masih ada risiko residual yang harus dipertimbangkan sebelum peluncuran publik.

Audit dengan `npm audit --omit=dev --json` mencatat **3 moderate, 0 high, 0 critical** pada rantai Mammoth/argparse/sprintf-js. Angka 10 pada audit lengkap menghitung paket yang terdampak, bukan 10 akar kerentanan terpisah. Bukti produksi: `dependency-audit-production.json`.

Regresi KaTeX menguji matematika inline/display melalui React Markdown, penolakan hyperlink aktif, dan penolakan nilai `trust` yang diwarisi dari Object.prototype. Ketiganya lulus pada KaTeX 0.18.2. Ini tidak menggantikan pengujian visual browser.

Rujukan maintainer untuk pembaruan framework: https://nextjs.org/blog/nextjs-security-update-october-14-2026 (diakses 22 Oktober 2026 WIB). Audit npm adalah snapshot advisory saat pemeriksaan, bukan jaminan keamanan masa depan.

## Batas dan recovery

Limiter hanya per proses dan reset saat restart; multi-replica memerlukan kontrol gateway/shared store. Batas request bukan batas tagihan USD. Pasang spending cap di akun Sumopod. Kuis Frontier adalah pembatas akses lokal, bukan identitas pengguna berjaminan tinggi. Harga semua model belum diverifikasi; Frontier default off.

Logout menghapus cookie browser; tidak ada registry pencabutan token individual. Token lama masih valid sampai kedaluwarsa bila telah dicuri. Rotasi ADMIN_SESSION_SECRET/AET_FRONTIER_ACCESS_SECRET membatalkan seluruh token terkait. Secrets tidak disertakan dalam ZIP dan tidak ditulis dalam laporan.

Upload Vercel Blob nyata, pentest independen, CSP menyeluruh, autentikasi pengguna umum, distributed limiter, antivirus/OCR, dan ketahanan terhadap semua bentuk prompt injection belum diverifikasi/diimplementasikan. Parser dokumen memiliki limit input, tetapi belum diisolasi dalam worker terpisah dengan kuota CPU/memori.
