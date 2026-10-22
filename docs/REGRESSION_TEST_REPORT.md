# Laporan regresi final — AET AI 2.1.1

Diperiksa ulang pada 22 Oktober 2026 WIB. Source awal: ZIP versi 2.1 yang diunggah bersama master prompt. Patch 2.1.1 mempertahankan Next.js 16.4.2, React 19.3.1, Prisma 5.22.0 dan SQLite.

| Pemeriksaan | Hasil final | Bukti |
| --- | --- | --- |
| npm ci --maxsockets=2 | PASS, 675 paket termasuk postinstall Prisma | checks/install.log |
| npx prisma generate | PASS | checks/prisma.log |
| npm run lint | PASS | checks/lint.log |
| npm test | PASS, 77/77, tanpa skipped | checks/test.log |
| npx tsc --noEmit | PASS | checks/types.log |
| npm run build | PASS, production build bersih | checks/build.log |
| npm run test:http | PASS, 84/84 | http-regression-2-1.json; checks/http.log |
| Integrasi aplikasi + Sumopod asli | PASS, 9/9 | live-app-current.json |
| Model chat/stream | PASS, 12/12 kandidat | model-verification-final.json |
| Vision gateway | GPT-4o Mini PASS; GPT-4.1 Mini INCONCLUSIVE, jawaban warna salah | vision-verification-current.json |
| Benchmark A/B | 60 baseline + 60 optimized, seluruh respons berhenti normal; 2 respons kebijakan sitasi terpisah | benchmark-audit-final.json |
| Subset objektif | Baseline 7/13; optimized 11/13; alur produksi 12/13 | benchmark-audit-objective.json |
| Kode Python terpilih | PASS, 6/6 snippet terbatasi | benchmark-audit-executable.json |
| Review rubrik sampel | 18 respons model dan 2 respons kebijakan ditinjau, bukan penilaian independen | benchmark-audit-manual-review.json |
| Preservasi database/schema | SHA-256 tetap identik | DATABASE_MIGRATION.md |
| Tool deterministik | 5/5 live harness lokal | external-tools-current.json |
| Cuaca, kurs, scraper, Tavily | BLOCKED / belum terverifikasi penuh | external-tools-current.json |
| Browser final | NOT VERIFIED; pembatasan kebijakan URL browser menghentikan kelanjutan QA | UI_VERIFICATION_2_1_1.md |

Pengujian HTTP memakai gateway simulasi dan salinan SQLite yang dibuang setelah tes. Pengujian live aplikasi memakai production server lokal, database salinan, dan Sumopod asli. Skenario live mencakup tiga persona, penolakan pembuatan DOI, koreksi anggaran, tanggal pendirian AET, PDF, konversi, serta gambar.

Pada build incremental, cache persistensi Turbopack sempat gagal dibaca (invalid digit found in string). Cache dipisahkan dan clean build berhasil; database SQLite aplikasi tidak disentuh. Harness live awal juga mematikan proxy untuk proses server sehingga panggilan upstream gagal. Setelah harness mempertahankan lingkungan koneksi yang semestinya, sembilan skenario lulus. Kedua kejadian bukan disembunyikan sebagai keberhasilan awal.

Audit dependency saat ini tetap 10 paket terdampak: 5 high dan 5 moderate, 0 critical. Paket high berada pada jalur lint development; jalur produksi DOCX memiliki 3 moderate. Ini bukan jaminan keamanan universal. Baca SECURITY_AUDIT_2_1.md.

Kamera fisik, TTS perangkat, keyboard virtual, browser lain, visual mobile final, Vercel Blob produksi dan beban multi-replica belum diverifikasi. Screenshot lama hanya arsip desain.
