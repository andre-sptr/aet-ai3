# Regresi final AET AI — 22 Oktober 2026

Waktu benchmark terakhir: 22 Oktober 2026, 11:58:24 WIB. Source implementasi: `c8e012a60889d5b5200106a0e47d572d5fe14ada`. Baseline ZIP disimpan pada commit lokal `500519a`; branch kerja `audit/ai-routing-20261022`, tanpa remote dan tanpa push.

| Pemeriksaan | Status | Hasil |
| --- | --- | --- |
| `npm ci --ignore-scripts --fetch-retries=0 --fetch-timeout=20000` | PASS | 675 packages installed using the existing unchanged lockfile. |
| `npm run postinstall` | PASS | Prisma Client 5.22.0 generated; no schema migration. |
| `npm test (before dependency installation)` | BLOCKED | 107 PASS, 7 import/dependency failures; 114 results. |
| `npm test (baseline after dependency installation)` | PASS | 116/116. |
| `npm test (final)` | PASS | 131/131. Includes 15 added test cases; local mock results are not live model evaluations. |
| `npm run test:benchmark:plan` | PASS | Exit 0; 96 cells intentionally BLOCKED/NOT RUN; 0 network requests. |
| `npm run lint` | PASS | Baseline and final no lint errors. |
| `npx --no-install tsc --noEmit` | PASS | Full project typecheck; baseline and final exit 0. |
| `npm run build` | PASS | Baseline and final Next.js production build exit 0. |
| `npm run test:http` | PASS | Baseline and final 84/84; copied disposable SQLite database and loopback mock gateway. |
| `npm run test:benchmark with supplied key in environment` | BLOCKED | Metadata HTTP 200; 12/12 exact IDs listed; 0 generation requests because provider cap/key binding and official rates unverified. Exit 2 is expected. |
| `Playwright Chromium installation for desktop/mobile QA` | BLOCKED | Chromium download was not a valid ZIP; no browser session or visual assertions were executed. |

## Sebelum dan sesudah

Instalasi awal belum tersedia: 107/114 hasil PASS dan tujuh kegagalan import. Setelah instalasi lockfile, **116/116 tes baseline PASS**. Tiga tes tambahan mereproduksi cacat metadata/preflight, urutan model, dan penanganan error direct POST pada kode awal. Setelah patch dan penambahan cakupan, **131/131 tes final PASS**. Lint, typecheck dan build lulus pada baseline dan final. HTTP **84/84** pada kedua versi. Tidak ada penurunan baru pada quality gates yang dijalankan.

Log reproduksi: `docs/checks/optimization-20261022/reproduced-harness-bugs.log` dan `reproduced-budget-binding.log`. Log iterasi antara tetap disimpan; `final-*` merupakan rujukan hasil akhir. Kesalahan serialisasi redaksi pada iterasi awal sudah diperbaiki sebelum tes final.

## Cakupan yang benar-benar diuji

Tes mencakup tiga persona, perakitan prompt dan konteks, koreksi terbaru, dokumen tidak tepercaya, request ID tepat, streaming terputus/kosong/terpotong, identitas model berbeda, abort, riwayat dan penghapusan, Markdown/URL, PDF/DOCX/TXT, otorisasi Frontier, origin, rate limit, CMS dan sesi admin. Tes HTTP memakai aplikasi hasil build, database salinan dan provider simulasi. Tes HTTP tidak menggunakan key Sumopod pengguna.

Tambahan baru: metadata 403 dan ID yang tidak tercantum tetap mengizinkan direct POST pada **LOCAL MOCK** dengan guard sah; satu gelombang smoke memuat seluruh 12 model; 403 generasi menghentikan run setelah satu request; key berbeda, tarif hilang, biaya gelombang berlebih dan batas request kecil menghasilkan nol generasi. Routing mengutamakan pilihan manual, membatasi Frontier/gambar/konteks, menolak laporan mock, serta tidak menambah request classifier atau fallback.

SHA-256 menunjukkan `prisma/schema.prisma`, `prisma/dev.db`, dependency/lockfile, autentikasi, seluruh komponen, aset dan stylesheet utama sama dengan ZIP masukan. Seluruh 87 dokumen/hasil lama selain contoh konfigurasi budget tetap identik. Nilai hash dan hasil terstruktur ada di `AI_REGRESSION_RESULTS_20261022.json`.

## Batas verifikasi

Browser desktop/mobile **BLOCKED**: unduhan Chromium gagal diekstrak. Karena itu klik UI, layout/responsivitas final, kamera dan TTS fisik tidak diklaim sudah diuji. Bukti hash mendukung preservasi source visual, bukan pengganti pemeriksaan visual browser.

Generasi 12 model, kualitas persona live, kualitas relatif, latensi generasi, tarif aktual dan billing **belum konklusif**. Tavily, Vercel Blob dan layanan eksternal lain tidak diuji ulang dengan kredensial nyata. Tidak ada klaim pengujian beban produksi atau pentest menyeluruh.
