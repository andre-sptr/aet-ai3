# AETAI — perbaikan routing berbasis bukti

Mulai dari:

1. `docs/benchmark-routing-analysis.md` — audit 96 sel, matriks 12 model, masalah dan keputusan.
2. `docs/routing-policy-guide.md` — konfigurasi, kontrak v2, promosi dan rollback.
3. `docs/routing-validation.md` — hasil tes dan pemeriksaan yang terhalang dependency.
4. `docs/routing-change-manifest.json` — file berubah beserta hash sebelum/sesudah.

Default tetap routing off. Baseline diperiksa kelayakannya; screening belum mengaktifkan promosi model lain. Policy v1 ditolak; file pending yang disertakan tidak aktif. Tidak ada uji live berbayar baru.

Paket proyek memuat source masukan beserta perbaikan, seluruh laporan benchmark asli dan analisis. Paket patch memuat hanya file baru/berubah dibanding ZIP masukan. Terapkan ke salinan proyek yang sama setelah mencadangkan perubahan lokal. Pertahankan .env, database, upload dan data deployment Anda. Jangan menghapus data yang tidak ada dalam paket; tidak ada migrasi database.

Untuk memeriksa tanpa provider: `npm run test:routing`, `npm run test:adaptive`, `npm run routing:audit`, dan `npm run routing:retest:plan`. Untuk deployment, pasang dependency sesuai lockfile lalu selesaikan lint, TypeScript, build dan tes HTTP yang belum tersedia dalam lingkungan penyerahan.
