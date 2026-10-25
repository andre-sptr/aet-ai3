# Menjalankan evaluasi kemampuan AI

Pembaruan 25 Oktober 2026: evaluator menghasilkan report v2 `application-evaluation` dengan fingerprint source/prompt dan request body tanpa header. Opsi operator `--candidate-model`, `--fixture`, dan `--variants` memungkinkan kalibrasi kandidat tanpa mengaktifkan policy produksi; default tetap plan tanpa jaringan. Lihat `routing-policy-guide.md` untuk kontrak dan `routing-retest-plan.json` untuk rencana yang belum diotorisasi. Report v1 lama dan screening 12×8 tidak otomatis menjadi policy produksi.

Skrip baru: `scripts/evaluate-ai.mjs`. Gunakan Node.js 24 dari root repo. Hasil dibuat pada `evaluation/run-<waktu>-<id>/`; run lama tidak ditimpa. Folder ini diabaikan Git. Skrip membaca `.env`, lalu `.env.local`; environment shell yang sudah ditetapkan tetap berlaku. Jangan mengunggah key, `.env`, atau kredensial.

## 1. Periksa alur tanpa biaya

```bash
npm run test:adaptive
npm run test:ai:plan
npm run test:ai -- --mock --repeat 3 --max-requests 250
```

`npm run test:ai` tanpa argumen adalah rencana tanpa jaringan. Matriks default: 10 kasus × baseline/Fast/Normal/Think × 3 pengulangan = 120 sampel chat. Seluruh planner/worker/verifier/revisi/retry tetap dihitung pada plafon generasi global. Jumlah chat bukan jumlah panggilan model.

Simulasi memakai jawaban fixture. Satu kontrol negatif membuat baseline yang memang kehilangan konteks lama gagal; hasil itu menguji jalur data, bukan kecerdasan model. Waktu dan token mock bukan latensi/usage provider nyata. Untuk batch simulasi yang dipercepat, limiter per menit diset 10.000 dalam proses simulasi saja; plafon per request tetap sama. Limiter produksi tetap default 120/menit dan diuji terpisah. Lihat label `LOCAL_MOCK` pada report. Sel tanpa eksekusi tetap NOT_RUN/BLOCKED dan skor tetap null.

Kasus meliputi fakta stabil, koreksi terbaru, fakta lama di luar 40 pesan, acuan opsi kedua, aritmetika, fungsi kode dengan validator aman, dokumen dengan prompt injection, DOI tanpa sumber, ketidakpastian JSON, serta perbandingan arsitektur. Kasus perbandingan memerlukan penilaian manusia. Tes sempit fungsi `last()` hanya mengeksekusi grammar fungsi yang di-allowlist, bukan kode model arbitrer.

## 2. Siapkan uji live

1. Isi `SUMOPOD_API_KEY` pada environment server lokal. Gunakan key khusus evaluasi.
2. Atur **cap provider yang benar-benar ditegakkan untuk key itu**, maksimal USD 3 sesuai mekanisme repo. Periksa langsung pada akun penyedia. Angka environment saja tidak cukup. Jika provider tidak menyediakan cap yang sesuai, jangan menyatakan bahwa cap sudah ada; tetap gunakan mode plan/mock.
3. Buat template lokal:

```bash
npm run test:ai:setup
```

Skrip membuat `evaluation/budget.json` dan `evaluation/pricing.json` jika belum ada, tanpa menimpa. Tidak ada key yang ditulis; hanya fingerprint SHA-256 key untuk mengikat attestasi. Jalankan sesudah key ditetapkan. Jika file lama sudah ada, periksa dan perbarui sendiri; setup tidak mengesahkan konfigurasi lama.

4. Edit `evaluation/budget.json`: `operatorVerified=true` dan `dedicatedKey=true` **hanya setelah** cap tersebut benar-benar diperiksa. Isi bukti pemeriksaan pada `evidence`, pastikan fingerprint cocok, providerBaseUrl benar, hardLimitUsd >0 dan ≤3, serta `verifiedAt` adalah waktu pemeriksaan sebenarnya (berlaku 24 jam).
5. Edit `evaluation/pricing.json`: masukkan tarif input/output USD per satu juta token yang berlaku pada gateway untuk `gpt-4o-mini`, URL sumber resmi, waktu pemeriksaan, lalu `operatorVerified=true`. Nilai null pada template sengaja memblokir live. Jangan mengambil tarif produk resmi lain untuk menganggap tarif gateway sama. Jika routing Anda memakai kandidat lain, tambahkan tarif kandidat tersebut juga.
6. Tambahkan konfigurasi lokal:

```dotenv
AET_LIVE_TEST_APPROVED=true
AET_TEST_BUDGET_USD=3
AET_BENCHMARK_BUDGET_FILE=evaluation/budget.json
AET_BENCHMARK_PRICING_FILE=evaluation/pricing.json
```

Ini adalah attestasi operator terhadap cap provider, bukan pemeriksaan billing otomatis. Skrip juga mereservasi estimasi biaya setiap percobaan dan menggunakan maksimal 80% cap sebagai margin. Estimasi bukan tagihan aktual. Maksimum seluruh generasi dapat diturunkan dengan `--max-requests`; retry dan peran tambahan tidak mendapat anggaran baru.

## 3. Jalankan pilot kecil, lalu perbandingan

Pilot:

```bash
npm run test:ai -- --live --cases simple-fact,latest-correction,arithmetic --repeat 1 --max-requests 24
```

Jika pilot dan budget sah, evaluasi tiga pengulangan:

```bash
npm run test:ai -- --live --repeat 3 --max-requests 250
```

Guard tetap menentukan apakah anggaran cukup. Jika tidak cukup, sel tersisa dicatat BLOCKED; jangan menghapus/mengganti status itu agar terlihat lengkap. HTTP 401/402/403/429 membuka circuit untuk sisa run tanpa rotasi model. Live hanya menggunakan gateway resmi yang terikat pada key. Skrip menjalankan **layanan orkestrasi produksi secara langsung**, bukan endpoint publik dan bukan pengujian browser/auth HTTP. Route produksi diuji terpisah dengan gateway simulasi dan `test:http` sesudah build.

Baseline mereproduksi jalur sebelumnya: satu generasi pada model default dengan seleksi maksimal 40 pesan/48.000 karakter dan persona yang sama. Keempat varian memperoleh fixture identik. Urutan varian diputar antar-pengulangan untuk mengurangi bias urutan sederhana. Tidak ada temperature, seed, reasoning_effort, native tools, atau parameter lain yang belum terbukti.

## 4. Berkas hasil untuk diunggah

| Berkas | Isi |
| --- | --- |
| `report.json` | Hasil tiap sampel, jawaban, check objektif, metadata tahap, usage yang tersedia, kesalahan, latensi dan ringkasan. |
| `summary.md` | Ringkasan lulus/gagal, p50/p95 dan keterbatasan. |
| `review.csv` | Lembar penilaian manusia tanpa label varian, dengan sample ID untuk dipetakan ke report. |

Unggah **report.json**. Tambahkan **review.csv** bila Anda/reviewer sudah mengisinya. Nilai kolom 0–5 untuk pemahaman konteks, kepatuhan instruksi, akurasi, dukungan sumber dan relevansi; biarkan kosong bila tidak dapat dinilai. Beri catatan masalah konkret. Untuk kasus tanpa sumber, jangan mengarang skor dukungan sumber. Sample ID menghubungkan penilaian ke varian setelah review.

Penilaian otomatis hanya menguji syarat yang dapat diukur: hasil exact/JSON, fungsi allowlist, marker injection, dan ketiadaan DOI yang dikarang. Penilaian tersebut tidak membuktikan seluruh klaim benar. Ukuran kata, jumlah tahap dan persetujuan verifier bukan skor kualitas umum. Biaya berbasis usage × tarif diberi label terpisah; tagihan provider aktual tetap unknown. Latensi mengukur waktu akhir-ke-akhir layanan dalam proses, termasuk tools/planner/worker, bukan waktu UI sampai token pertama.

Saat hasil diunggah, analisis yang layak membandingkan kasus berpasangan, variasi antar-run, kesalahan per kategori, kelengkapan usage, biaya berbasis tarif, serta trade-off latensi. Tiga pengulangan adalah awal kalibrasi, bukan bukti statistik yang kuat untuk semua tugas. Policy routing tidak dipromosikan otomatis dari jumlah PASS.

## 5. Menguji 12 kandidat model

Harness model yang sudah ada tetap terpisah:

```bash
npm run test:benchmark:plan
npm run test:ai:setup -- --all-models
npm run test:ai:models
```

Setup tidak menimpa pricing.json yang sudah ada; tambahkan 12 tarif secara manual bila file itu telah dibuat sebelumnya. Harness ini memakai 12 ID katalog × 8 kasus (96 sel), guard key/cap yang sama, serta tarif semua ID. Metadata dan generasi berbeda: ID tersedia pada daftar model tidak membuktikan native tools, reasoning parameter, vision atau kualitas.

Jangan menjalankan matriks berbayar massal tanpa guard sah. Upload laporan JSON hasil harness ini jika ingin menilai kandidat routing. Bukti live baru harus dipadukan dengan review manusia dan dibandingkan dengan baseline pada kasus yang setara. Jalankan `test:vision` hanya mengikuti guard repo bila kalibrasi gambar diperlukan; kemampuan/biaya gambar belum diverifikasi ulang pada pekerjaan ini.

## 6. Quality gates setelah dependency tersedia

```bash
npm ci
npx prisma generate
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:http
```

Sesudah itu lakukan QA desktop/mobile: persona × tiga mode, pergantian mode pada percakapan yang sama, radio keyboard, upload, stop, pindah chat, edit, retry, hapus, reload dan pembacaan sumber. Hasil lokal saat penyerahan dicatat dalam VALIDATION_20261024.md; build/visual yang belum dijalankan tidak dianggap lulus.
