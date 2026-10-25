# Validasi perubahan routing — 25 Oktober 2026

Lingkungan: Node.js 24.22.1, npm 11.9.0. Tidak ditemukan dependency proyek terpasang. Tidak ada generasi provider berbayar baru; pengujian menggunakan fixture/loopback atau live guard yang sengaja belum disetujui sehingga mengirim nol generasi.

| Pemeriksaan | Hasil yang benar-benar diamati |
| --- | --- |
| Baseline `npm test` sebelum edit | 172 tes: 165 lulus, 7 gagal karena dependency tidak tersedia |
| `npm run test:routing` setelah perubahan | 68/68 lulus |
| `npm run test:adaptive` | 112/112 lulus |
| `npm test` setelah perubahan | 183 tes: 176 lulus, 7 gagal; kelompok kegagalan sama dengan baseline |
| `npm run routing:audit` | Lulus; 96 sel, lineage dan original request/validator diverifikasi |
| `npm run routing:retest:plan` | Lulus; konsistensi rencana tanpa menjalankan generasi |
| Parse 18 modul berubah melalui `node:module.stripTypeScriptTypes` + `vm.SourceTextModule` | Lulus, 0 parse error; bukan pemeriksaan tipe semantik atau Next.js build |
| `npm ci --ignore-scripts --offline --no-audit --no-fund` | Terhalang ENOTCACHED untuk dependency |
| `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=12000` | Terhalang HTTP 403 registry npm |
| `npm run lint` | Tidak berjalan: eslint tidak terpasang, exit 127 |
| `npm exec --offline --package=typescript -- tsc --noEmit` | Tidak berjalan: TypeScript tidak ada di cache, ENOTCACHED |
| `npm run build` | Tidak berjalan: next tidak terpasang, exit 127 |
| `npm run test:http` pada hasil build / QA browser / integrasi live | Belum dijalankan; build dan layanan eksternal belum tersedia |

Tujuh kegagalan seluruh suite: retrieval AET yang memerlukan Mammoth; empat tes PDF yang memerlukan pdf-parse (ekstraksi, scan, encrypted, terlalu banyak halaman); satu tes ekstraksi DOCX yang memerlukan Mammoth; satu berkas pengujian rendering yang memerlukan React. Error dependency dicatat sebagai gagal/terhalang, tidak diubah menjadi lulus atau di-skip. Tidak ada dependency atau lockfile yang diganti untuk menyembunyikan keterbatasan ini.

Log baseline dan final disertakan di `docs/validation/routing-*.log`. Peringatan npm tentang http-proxy merupakan keadaan lingkungan; tidak ada proxy/credential yang diubah. Ketika dependency tersedia, jalankan lint, full TypeScript, build, seluruh tes, dan test:http sebelum deployment.

## Perilaku yang dibuktikan tes

- Tugas coding/akademik tetap dikenali saat ada dokumen atau history besar; long context menjadi kebutuhan terpisah. Persona, mode, role dan kompleksitas mempunyai scope sendiri.
- Follow-up/koreksi mengambil tugas pengguna sebelumnya, sementara topik baru tidak mewarisi kategori coding dari keyword lama atau jawaban assistant.
- Off/shadow/adaptive deterministik; shadow tidak mengirim request kandidat tambahan. Manual model serta field evaluator pada payload HTTP tidak membuka akses server.
- Baseline dengan bukti kualitas gagal tetap menjadi comparator yang sah; kandidat harus memenuhi ambang kualitas sendiri. Tanpa baseline pembanding, kandidat tidak dipromosikan.
- Policy v1 self-asserted, pending, hilang/rusak, hash dataset/report/pipeline/prompt tidak cocok, plan/mock, scope belum diuji, sampel kurang dan repeat duplikat tidak dapat mempromosikan kandidat.
- Checks yang tidak sesuai jawaban mentah ditolak. Usage hilang tetap null, biaya tidak menjadi nol, review AI/absen tidak dianggap review manusia.
- Frontier, gambar, dokumen, tool evidence, input/output, role, kompleksitas, response mode, kesehatan baseline dan budget membatasi keputusan.
- SSE seluruh persona × response mode, cancel/abort, error provider, lifecycle, deadline, publikasi hanya hasil akhir dan metadata model actual/reported diuji dengan fixture.
- Shared cooldown auth/billing/permission/rate limit, satu retry pada model yang sama, reservasi seluruh role dan tidak ada duplikasi jawaban tetap diuji.
- Evaluator internal menggunakan ID model dan parameter keluarga yang tepat, memberi label evaluation_only, tidak mengubah policy produksi, dan tidak bisa melewati Frontier. Plan kandidat tetap mengirim nol generasi.
- Audit final menemukan 61 objek inherited identik, 35 percobaan baru, 9 truncation, 4 kegagalan format JSON dengan semantik cocok, serta 4 jawaban salah. Laporan asli tidak ditulis ulang.

Fixture sintetis mencantumkan penanda SYNTHETIC dan hanya menguji kontrak software. Label live/human pada input fixture tidak menyatakan panggilan live atau persetujuan manusia sebenarnya. Berkas sementara fixture tersebut tidak termasuk paket hasil. Tidak ada peningkatan kualitas, biaya atau kecepatan model yang diklaim dari pengujian software ini.

## Integritas paket

Manifest perubahan menggunakan byte source dari ZIP masukan sebagai baseline, bukan Git HEAD yang sudah memiliki perubahan pengguna. Semua original report/checkpoint/Markdown benchmark dan file source yang tidak disentuh diperiksa hash. Paket tidak berisi .env pribadi, database pengguna, .git, node_modules, .next atau output fixture sementara. Tidak ada migrasi database atau perubahan data pengguna.
