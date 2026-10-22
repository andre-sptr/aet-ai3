# Kebijakan Smart Model Routing AET AI

## Perilaku saat ini

`AET_ROUTING_MODE=off` adalah default. `gpt-4o-mini` tetap dipakai jika request tidak memilih model. Seluruh model manual yang sah, termasuk pilihan eksplisit default, tetap dipertahankan. Otorisasi Frontier dan kebijakan ketersediaan model tetap diberlakukan setelah keputusan routing. Tidak ada model cadangan otomatis, panggilan classifier LLM atau model judge.

UI pemilih model tidak diubah dan tetap mengirim pilihan manual; karena itu pilihan pada UI selalu menang. Pengelola yang kelak mengaktifkan routing untuk klien API harus mengirim request tanpa field `model`. Tidak ada tombol Auto baru atau perubahan layout dalam patch ini.

| Kategori | Sinyal lokal |
| --- | --- |
| Long-context | Lampiran dokumen atau konteks >=24.000 karakter |
| Coding | Persona coding, atau istilah coding pada instruksi langsung |
| Academic | Persona report, atau intent penelitian/akademik |
| Reasoning | Kata kendala/deduksi/perhitungan pada instruksi langsung |
| Daily | Permintaan biasa yang memiliki teks |
| Uncertain | Tidak ada sinyal teks yang cukup |

Isi dokumen tidak digunakan sebagai instruksi routing. Classifier ini aturan praktis, bukan model pemahaman semantik; salah klasifikasi tetap mungkin. Model tidak dinaikkan hanya karena tugas terlihat sulit.

## Mode dan pengembalian aman

| Mode | Perilaku |
| --- | --- |
| `off` | Pakai pilihan manual atau default; tidak membaca file kebijakan |
| `shadow` | Hitung rekomendasi lokal jika bukti cukup; tetap gunakan default |
| `adaptive` | Beralih hanya jika kandidat dan pembanding default memenuhi gate |

Set `AET_ROUTING_MODE=off` dan restart proses aplikasi untuk menonaktifkan routing. Tidak memerlukan migrasi, perubahan database atau penghapusan riwayat. File kebijakan hilang, rusak, terlalu besar atau tanpa bukti yang memenuhi syarat menghasilkan default. Kegagalan model terpilih ditampilkan sebagai error, tanpa retry atau penggantian model diam-diam.

## Gate bukti sebelum promosi

`AET_ROUTING_POLICY_FILE` menunjuk file JSON server yang dikelola operator. Contoh `docs/routing-policy.example.json` sengaja berisi `evidence: []`, sehingga tidak mengaktifkan kandidat. File maksimum 256 KB. Referensi laporan hanya di bawah `docs/`, tanpa traversal; setiap laporan maksimal 8 MB.

Setiap kandidat harus memiliki:

- ID pada katalog aktual, akses sah, kemampuan gambar yang sudah terverifikasi bila dibutuhkan.
- `sourceKind: live`, umur bukti maksimum tujuh hari, `reportRef` dan dataset SHA-256 yang cocok.
- Minimal tiga case ID berbeda, sample count sesuai jumlah baris laporan yang dirujuk, dan hasil yang betul-betul attempted.
- Nilai objective pass dan streaming success sesuai baris raw report; setiap keberhasilan transport memerlukan HTTP 200, identitas model cocok, finish stop, dan output nonkosong. Laporan mock/plan tidak diterima.
- Objective pass, context pass dan instruction pass >=0,90; streaming success =1; review manusia approved dengan skor 4–5 dan identitas reviewer.
- Latensi p95 dan biaya per request yang terverifikasi di bawah batas kebijakan; panjang input tidak melampaui cakupan yang diuji.
- Pembanding `gpt-4o-mini` yang juga memenuhi gate, pada comparisonSet dan case IDs yang persis sama. Tidak ada promosi bila pembanding default tidak tersedia.

Di antara kandidat yang memenuhi gate, urutan pembanding: objective pass, skor review kualitatif, biaya lebih kecil, lalu latensi lebih rendah. Angka batas 5.000 ms dan USD 0,01 pada contoh adalah batas kebijakan operator, bukan hasil pengukuran atau klaim kemampuan model. Tidak ada angka performa model yang diisi pada contoh.

Metrik review, context/instruction dan biaya harus disusun dari penilaian operator yang dapat diaudit. Validator runtime memeriksa konsistensi dengan raw report, tetapi bukan sistem penagihan atau layanan verifikasi sitasi/biaya independen. File kebijakan hanya untuk operator tepercaya, bukan unggahan pengguna. Harus dicatat bahwa cakupan dataset kecil belum membuktikan kemampuan umum model.

## Bentuk satu record bukti

Gunakan tipe `RoutingEvidence` di `lib/ai/model-router.ts` sebagai kontrak. Field wajib: `modelId`, `category`, `sourceKind`, `reportRef`, `comparisonSet`, `caseIds`, `sampleCount`, `verifiedAt`, `objectivePassRate`, `contextPassRate`, `instructionPassRate`, `streamingSuccessRate`, `qualitativeReview` (`status`, `reviewer`, `score`), `p95LatencyMs`, `costUsdPerRequest`, `costVerified`, dan `maxTestedInputChars`. Nilai harus berasal dari laporan/penilaian sebenarnya; jangan menyalin metrik synthetic fixture pada tes.

Keputusan dicatat melalui SSE `meta.routing`, `X-AET-Model` dan `X-AET-Routing-Reason`. Hanya mode, kategori, ID model, alasan dan referensi bukti yang dicatat, tanpa teks percakapan. Pergantian model tidak menghapus/mengubah riwayat yang dikirim. Identitas model yang dilaporkan gateway tetap diperiksa parser; output aplikasi deterministik tetap memiliki origin aplikasi.

## Hasil penerapan sekarang

Belum ada output live baru yang dapat dievaluasi. Tidak ada record kandidat yang dibuat, tidak ada pemenang kategori yang diumumkan, dan adaptive tidak diaktifkan. Tes keputusan menggunakan metrik sintetis yang diberi label fixture; integrasi route memverifikasi kebijakan dan laporan buatan hanya dalam pengujian lokal lalu membersihkan file tersebut. Manfaat kualitas, latensi dan biaya routing pada produksi belum terukur.
