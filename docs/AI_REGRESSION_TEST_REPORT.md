# Laporan regresi audit AI — 22 Oktober 2026

**Status keseluruhan: BLOCKED.** Patch logika yang dapat diuji lulus; seluruh quality gates produksi belum dapat dinyatakan lulus. Node 24.19.0, npm 11.9.0. Tidak ada deployment, push, reset, migration, seed, db push, atau perubahan kredensial produksi.

| Perintah/pemeriksaan | Exit | Status | Hasil aktual |
| --- | --- | --- | --- |
| `npm ci --offline --ignore-scripts --no-audit` | 1 | BLOCKED | ENOTCACHED; dependency tidak ada dalam cache |
| `npm ci --ignore-scripts --no-audit --maxsockets=2 --fetch-retries=0 --fetch-timeout=12000` | 1 | BLOCKED | E403 registry npm |
| `npm test (baseline sebelum patch)` | 1 | BLOCKED | 45 hasil dilaporkan: 41 PASS, 4 file test gagal import dependency; bukan seluruh 77 kasus pada arsip |
| `npm test (patch final)` | 1 | BLOCKED | 114 hasil: 107 PASS, 7 FAIL karena dependency belum tersedia, 0 skipped |
| `npm run test:history` | 0 | PASS | 30/30: riwayat, lifecycle, parser streaming dan kompatibilitas CMS helpers |
| `Node --test subset tanpa dependency eksternal` | 0 | PASS | 79/79; mencakup 10 handler route produksi dengan gateway simulasi |
| `Node --test tests/chat-route.test.mts` | 0 | PASS | 10/10 integrasi handler langsung; bukan full Next.js server, bukan Sumopod nyata |
| `npm run test:tools` | 0 | INCONCLUSIVE | 5 PASS lokal, 4 BLOCKED eksternal/konfigurasi; exit 0 bukan seluruh layanan berhasil |
| `npm run test:benchmark` | 2 | BLOCKED | 1 preflight metadata HTTP 403; 0 generasi; 96 sel tidak dijalankan |
| `npm run lint` | 127 | BLOCKED | eslint tidak terpasang |
| `TypeScript 5.9.3 cached/bin/tsc --noEmit --pretty false` | 2 | BLOCKED | Pemeriksaan konfigurasi proyek gagal resolve React/Next/dependency dan tipe terkait |
| `TypeScript 5.9.3 --strict --noEmit (subset core)` | 0 | PASS | Core storage/lifecycle/gateway/context/tools/persona/URL; Node types 25.9.5 runtime, bukan seluruh aplikasi atau Node types target lockfile |
| `npx --no-install prisma generate` | 1 | BLOCKED | Prisma tidak tersedia; upaya resolusi registry menerima E403 |
| `npm run build` | 127 | BLOCKED | next tidak terpasang |
| `npm run test:http` | 1 | BLOCKED | Tidak ada .next/BUILD_ID; full HTTP/CMS regression memerlukan build |
| `node scripts/check-source-syntax.mjs (TypeScript 5.9.3 dari cache)` | 0 | PASS | 103 TS/TSX/MTS/MJS berhasil diperiksa sintaks/transpilasi; bukan semantic full typecheck/build |

Raw command logs berada di `checks/full-audit-20261022/`; hasil terstruktur di `AI_REGRESSION_TEST_RESULTS.json`. Command subset lengkap dapat dilihat pada `targeted-final.log` melalui nama tes; file yang dijalankan: cms-history, conversation-deletion, streaming, security, sumopod, benchmark-harness, tool-integrity, chat-route, dan message-url.

## Tujuh kegagalan pada npm test

1. Retrieval/cache AET: Mammoth belum terpasang, sehingga evidence mengembalikan error yang jujur.
2. PDF valid: pdf-parse belum terpasang.
3. PDF scan: parser belum terpasang; penolakan scan belum dapat dibuktikan.
4. PDF terenkripsi: parser belum terpasang; penolakan enkripsi belum dapat dibuktikan.
5. PDF >100 halaman: parser belum terpasang; batas halaman belum dapat dibuktikan.
6. DOCX: Mammoth belum terpasang.
7. Bootstrap file renderer: React dan dependency renderer belum terpasang, sehingga tiga kasus renderer di file tersebut belum dimuat.

Ketujuhnya adalah **FAIL pada output test runner**, diklasifikasikan **BLOCKED environment** dalam audit; tidak diubah menjadi skipped atau PASS. Tes PDF diperketat agar error import tidak lagi memenuhi assertion penolakan file secara palsu. TXT dipisahkan dan benar-benar diuji, termasuk melalui handler upload produksi.

## Penghapusan: bukti dan batas pengujian

Tes Storage memakai implementasi in-memory dari interface Storage, lalu menjalankan fungsi persistence dan reload produksi yang sebenarnya. Tes membuktikan ID/payload hilang dari JSON key mode, item lain tetap ada, fallback aktif benar, sesi kosong tidak dipersistenkan sebagai entri, key legacy dibersihkan setelah migrasi aman, snapshot lama ditolak, serta storage failure tidak mengembalikan hasil sukses. Lifecycle menggunakan pekerjaan tertunda untuk menguji respons AI/lampiran setelah invalidasi. Uji route membuktikan abort membatalkan reader dan melepaskan concurrency slot.

Tes ini bukan klik UI React atau `localStorage` pada browser nyata. Desktop/mobile, focus restoration, pergantian mode melalui UI, rename/search/new/edit/retry melalui klik, upload FileReader/canvas/kamera, serta reload halaman browser belum diverifikasi visual karena full aplikasi tidak dapat dibangun. Perilaku helper untuk operasi tersebut diuji; hasilnya tidak dipromosikan menjadi QA UI lengkap.

## Integrasi dan model

Sepuluh skenario handler langsung memakai source `app/api/chat/route.ts` dan `app/api/attachments/route.ts`; loader test hanya menyamakan alias `@/` dengan tsconfig. Origin, validasi, Frontier off, limiter, persona, tools, pemilihan konteks, pembuatan request, parser SSE dan error handler tetap kode produksi. Fetch gateway disimulasikan di proses test. Tidak memakai database produksi atau menurunkan proteksi SSRF.

Harness 12 model juga diuji dengan HTTP gateway lokal simulasi: seluruh 96 request memakai ID yang tepat, prompt produksi dan output-limit sesuai keluarga. Review kualitatif Daily/Report tetap INCONCLUSIVE, walaupun fixture objektif memenuhi batas. Token fixture bukan token Sumopod. Uji negatif ID model memastikan output model lain tidak diteruskan.

Benchmark Sumopod nyata berhenti pada metadata HTTP 403. Keberhasilan mock bukan bukti kemampuan/availability provider. Key sementara tidak ditulis ke environment file atau source, dan tidak dikirim pada probe yang terblokir; validitas key belum diuji.

## Menjalankan ulang

Setelah akses registry diperbolehkan, jalankan instalasi dari lockfile, Prisma generate, npm test, lint, `npx tsc --noEmit`, build dan test:http. Lanjutkan QA UI desktop/mobile serta PDF/DOCX. Tidak ada kebutuhan perubahan schema. Untuk benchmark nyata, gunakan key environment dan bukti cap provider yang sah; variabel anggaran sendiri tidak cukup.

## Percobaan awal yang juga dipertahankan

`benchmark-harness-tests.log` merekam satu assertion redaksi yang terlalu luas: nama field boolean sentAuthorization ikut cocok dengan pola larangan Authorization; assertion diperbaiki agar memeriksa nilai/header rahasia, lalu 6/6 harness tests lulus. Tidak ada key nyata pada fixture tersebut. `core-current.log` merekam fixture SSE lama yang belum menyertakan finish_reason=stop; fixture diperbarui sesuai kontrak ketat dan tes penolakan DONE saja ditambahkan. `full-test-after.log` adalah snapshot sebelum assertion PDF diperketat, sehingga tiga hasil penolakan PDF di sana tidak dipakai sebagai bukti parser berfungsi. Hasil final tetap log final-test.log; hasil awal tidak dihapus atau diganti sebagai PASS.
