# Patch pemulihan benchmark AETAI

Patch untuk proyek aet-ai 2.2.0 dari aet-aiv3(1).zip yang digunakan pada sesi ini.
Menangani kegagalan penggantian laporan Windows dan melanjutkan report-recovered.json.

## Pasang

1. Pastikan proses benchmark lama sudah berhenti.
2. Cadangkan `scripts/benchmark-all-models.mjs` di luar folder `scripts`.
3. Ekstrak isi ZIP ke `D:\Website\aet-aiv3`. Gabungkan folder scripts/tests dan
   izinkan penggantian `scripts/benchmark-all-models.mjs`.
   Pastikan helper baru ada pada `scripts/benchmark-recovery.mjs`.
4. Pertahankan `.env`, key test2, credit limit provider, budget.json, pricing.json,
   fixture, dan file laporan lama. Patch tidak membawa kredensial atau JSON budget/pricing.
   `AET_BENCHMARK_MAX_REQUESTS` tetap 96 sebagai batas TOTAL lama+baru, bukan 35.
   `AET_BENCHMARK_MAX_TOKENS` tetap 512 agar protokol lama cocok (Gemini tetap 1024
   melalui konfigurasi keluarga model yang sudah ada).

Jika skrip benchmark lokal sudah diedit sendiri setelah ZIP awal, simpan salinan
perubahan itu dan tinjau perbedaan sebelum menggantinya. Opsi resume menolak request,
fixture, katalog, atau batas output yang berbeda dari sumber.

## Periksa tanpa biaya

Jalankan di PowerShell dari folder proyek:

```powershell
node --env-file=.env --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-all-models.mjs --resume ".\docs\benchmarks\run-2026-10-25T06-46-37-484Z-9a7a40fa\report-recovered.json" --plan
```

Output awal yang diharapkan:

```text
RESUME: retaining 61 attempted cells; 35 remain. Prior outcomes, including FAIL, are not retried.
```

Ringkasan menampilkan retainedRequests 61, newRequests 0, modelRequests 61.
metadataRequests dapat tetap 1 karena mempertahankan penghitung historis; mode --plan
tidak menambah request metadata maupun generasi. Status FAIL dari sumber tetap muncul.
Laporan plan bukan sumber untuk resume live; gunakan report-recovered.json semula.

## Lanjutkan pengujian live

```powershell
node --env-file=.env --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/benchmark-all-models.mjs --resume ".\docs\benchmarks\run-2026-10-25T06-46-37-484Z-9a7a40fa\report-recovered.json"
```

Ini mengirim maksimal 35 generasi tambahan jika guard dan cadangan biaya mengizinkan.
61 baris yang sudah attempted tetap dipertahankan, termasuk 13 FAIL dan 15 INCONCLUSIVE.
9 kegagalan karena output length tidak diulang otomatis. Perbaikan batas token untuk
kalibrasi baru harus menjadi pengujian terpisah dengan penandaan protokol yang berbeda.

Sumber tidak ditimpa. Hasil gabungan disimpan pada folder run baru. Gunakan lokasi
`reportFile` pada ringkasan akhir untuk mengambil laporan terbaru.

Credit limit provider dan key khusus harus tetap yang sama dengan pengujian awal.
Key jangan dipakai proses lain secara bersamaan. Bukti cap dan tarif tetap diperiksa
ulang dengan masa berlaku 24 jam. Jangan menambah cap untuk mengakali guard.
Estimasi historis USD 0.73997555 tetap dihitung; cadangan perkiraan sisa 35 sel pada
tarif yang sama adalah USD 0.45250553, sehingga total perkiraan reservasi USD 1.19248108.
Angka ini adalah reservasi konservatif harness, bukan tagihan; pemakaian token dan
biaya aktual sumber tetap tidak diketahui. Tarif yang berubah memerlukan evaluasi
terpisah; continuation menolak tarif baru agar satu laporan tetap konsisten.

Laporan v2 lama belum menyimpan fingerprint key di report. Karena itu identitas key
historis tidak dapat dibuktikan dari file itu saja. Guard tetap mencocokkan key aktif
dengan budget.json dan melabeli keterbatasan sumber lama pada resume. Laporan baru
menyimpan hash key untuk menolak pergantian key pada continuation berikutnya.

## Jika Windows kembali menolak rename

- Skrip mencoba ulang penggantian file dengan jeda terbatas.
- Snapshot JSON lengkap ditulis lebih dahulu. Jika rename terus ditolak, snapshot
  `report-checkpoint-<waktu>-<id>.json` dipertahankan dan run dapat berlanjut.
- File lama tidak dihapus atau dikosongkan sebagai fallback.
- Jika snapshot pun tidak bisa ditulis, run berhenti sebelum request berikutnya.
- Laporan Markdown bersifat tambahan; JSON tetap menjadi sumber hasil.
- Setiap dispatch dicatat sebelum request. Bila proses terhenti saat request berjalan,
  sel itu tidak diulang otomatis karena mungkin sudah ditagihkan; hasilnya tetap
  belum diketahui sampai ada bukti tambahan.

Jangan mengulang perintah live dengan source lama setelah continuation sudah dimulai.
Ada file klaim yang memblokir pengulangan source yang sama dari direktori yang sama.
Jika continuation terhenti, gunakan checkpoint TERBARU dari folder run continuation
yang disebut dalam pesan/claim, bukan recovered report awal atau hasil --plan.
Jangan hapus file claim untuk memaksa ulang request. Jangan jalankan proses benchmark
ganda atau membuat salinan source di direktori lain untuk melewati perlindungan ini.

## Validasi

```powershell
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/benchmark-harness.test.mts tests/benchmark-recovery.test.mts
```

15 tes lulus di lingkungan lokal Linux dengan server simulasi loopback, tanpa request
AI berbayar. Cakupan: lock Windows sementara/permanen melalui simulasi error EPERM,
retensi snapshot, kegagalan tulis, penjagaan budget kumulatif, resume 61+35, retensi
hasil FAIL, checkpoint in-flight, pencegahan replay source, protokol yang berubah,
circuit provider, dan guard budget tidak valid. Uji --plan atas report-recovered.json
asli juga mempertahankan seluruh 61 hasil tanpa perubahan. Sintaks kedua skrip lulus.
Eksekusi nyata pada Windows belum diuji di lingkungan ini.
