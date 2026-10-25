# Patch pencatatan usage streaming AETAI

Masalah: semua 54 sampel kalibrasi awal mencatat usage=null. Tiga probe live
terpisah menunjukkan usage hanya tersedia setelah request memuat
stream_options.include_usage=true. Parser produksi sudah membacanya dengan benar.

## Perubahan

- lib/sumopod.ts meminta usage pada streaming ke origin resmi Sumopod untuk
  gpt-4o-mini, gpt-5.4-mini, dan deepseek-v4-flash. Model lain serta request
  non-streaming mempertahankan bentuk request sebelumnya.
- scripts/stream-usage-probe.mjs mempertahankan kontrol eksplisit tanpa opsi
  usage meskipun builder aplikasi kini menambah opsi secara otomatis.
- Audit screening historis menerima tepat bentuk request lama tanpa opsi,
  atau bentuk baru yang dihasilkan adapter. Semua field generasi lainnya
  tetap diperiksa secara exact. Laporan asli tidak dimodifikasi.
- Pengujian baru meniru gateway yang hanya mengirim usage jika diminta, lalu
  memeriksa token mentah, total telemetry, biaya berdasarkan tarif, serta
  penanganan usage yang tetap hilang.

Tidak ada konfigurasi environment baru atau migrasi database.

## Pemasangan di Windows

Ekstrak isi ZIP ke D:\Website\aet-aiv3 dan izinkan penggantian berkas yang
ada dalam paket. Gunakan pada versi proyek yang dipakai dalam sesi ini.
Jika file source tersebut telah diubah sendiri, simpan salinan perubahan lokal
sebelum menerapkan file pengganti. File ini tidak berisi .env, key, pricing,
budget, database, atau laporan live pengguna.

Jalankan dari root proyek:

    npm run test:routing
    node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/usage-accounting.test.mts tests/stream-usage-probe.test.mts

Target: 69 tes routing dan 15 tes khusus usage/probe lulus.

## Membuat bukti kalibrasi baru

Patch mengubah fingerprint source pipeline. Laporan aplikasi sebelum patch
memiliki pipelineSha256 berbeda dan tidak dapat dipakai untuk promosi pada
source baru. Usage yang sebelumnya hilang tetap null; tidak ada pengisian
estimasi sebagai token yang dilaporkan gateway.

Setelah memeriksa sisa cap provider dan masa berlaku guard/tarif, jalankan
baseline terlebih dahulu:

    npm run test:ai -- --live --candidate-model gpt-4o-mini --fixture tests/fixtures/routing-retest-daily.json --variants fast --repeat 3 --max-requests 18

Periksa report.json baru: raw telemetry.attempts[].usage berisi prompt_tokens
serta completion_tokens, usage berisi inputTokens/outputTokens, dan
usageBasedCostUsd dapat dihitung dari tarif. actualBilledCostUsd tetap null
karena penghitungan token x tarif bukan bukti tagihan provider.

Baseline boleh tetap HAS_FAILURES jika jawaban/formatnya gagal tes. Kegagalan
objektif dipertahankan dan tetap dapat menjadi comparator sesuai policy v2.

Sesudah kelengkapan usage baseline dikonfirmasi, jalankan kandidat dengan
fixture dan mode yang sama:

    npm run test:ai -- --live --candidate-model gpt-5.4-mini --fixture tests/fixtures/routing-retest-daily.json --variants fast --repeat 3 --max-requests 18
    npm run test:ai -- --live --candidate-model deepseek-v4-flash --fixture tests/fixtures/routing-retest-daily.json --variants fast --repeat 3 --max-requests 18

Setiap perintah merencanakan 18 sampel dan membatasi seluruh panggilan model,
termasuk retry, pada 18. Tiga run penuh adalah maksimal 54 generasi baru jika
semuanya dijalankan. Gunakan cap key yang sama; biaya sebelumnya tetap dihitung
oleh provider. Jangan menjalankan beberapa live run bersamaan.

Setelah hasil baru selesai, human review dan descriptor policy v2 masih perlu
dilengkapi. Biarkan AET_ROUTING_MODE=off selama pengumpulan bukti.

## Validasi lokal

Dilakukan di Linux dengan Node.js 24, tanpa panggilan AI berbayar:

- test:routing: 69/69 lulus.
- Suite usage, probe, parser streaming, adapter Sumopod, benchmark harness dan
  recovery: 48/48 lulus.
- routing:audit dan routing:retest:plan --check: lulus, tanpa mengubah laporan.
- Tes integrasi yang mereproduksi usage kosong gagal pada source sebelum
  patch dan lulus sesudah opsi request ditambahkan.

Pengujian Windows, provider live dengan source patch, lint, build, dan
semantic TypeScript belum dijalankan di lingkungan ini.

Fingerprint pipeline baru:
9c89c4000ff157eea641afcaf3e122fd9bd4445cee8ae9a2e22ae4f16f7ff6af

Fingerprint prompt tetap:
fd913dd42fd9f8eaf07e4a9e244a2ce777ea9fe52dc987b8bec7d5ac38a62297

## Bukti kompatibilitas usage

Lihat stream-usage-verification-20261025.json untuk ringkasan dari tiga
laporan diagnostik live pengguna. Ringkasan ini tidak menjadi kalibrasi
produksi dan tidak berisi penilaian manusia.
