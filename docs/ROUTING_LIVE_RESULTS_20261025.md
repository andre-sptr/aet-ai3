# Hasil live routing AETAI — 25 Oktober 2026

Scope: persona daily, varian fast, role answer; 6 kasus, masing-masing 3 pengulangan.

| Model | Reasoning lulus | Konteks lulus | Total lulus | Median ms | P95 ms | Cadangan estimasi USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-4o-mini | 0/9 | 9/9 | 9/18 | 888 | 3060 | 0.04307535 |
| gpt-5.4-mini | 9/9 | 9/9 | 18/18 | 859 | 4240 | 0.25508025 |
| deepseek-v4-flash | 9/9 | 9/9 | 18/18 | 1401 | 6105 | 0.08544330 |

Seluruh 54 panggilan tercatat HTTP 200 dan selesai. Tidak ada error eksekusi.
Usage token kosong pada seluruh 54 percobaan; usageBasedCostUsd dan actualBilledCostUsd tetap unknown.
Cadangan estimasi pada tabel bukan tagihan aktual dan bukan perbandingan biaya penggunaan terukur.

Fingerprint dataset, pipeline dan prompt cocok pada ketiga laporan. Batas output aktual 1536 token, dengan parameter sesuai keluarga model.
Hasil ini belum mencakup persona lain, mode lain, dokumen, gambar, tools atau tugas panjang.
Tiga pengulangan adalah kalibrasi awal; perbedaan latensi bukan bukti statistik yang kuat.

## Temuan objektif

- gpt-4o-mini salah pada ketiga pengulangan hitungan belanja dan penjadwalan.
- Jawaban ketidakpastian gpt-4o-mini benar secara isi setelah blok Markdown dibuang hanya untuk diagnosis, tetapi tetap FAIL pada kontrak JSON mentah asli.
- gpt-5.4-mini dan deepseek-v4-flash memenuhi semua pemeriksaan objektif pada suite ini.
- Review manusia belum disediakan; dokumen ini adalah analisis otomatis, bukan attestasi human review.
- Source pipeline belum diubah untuk menambahkan usage. File probe tambahan menguji dukungan opsi secara terpisah.

## Provenance

Dataset SHA-256: c86066e159a62d5f130b169f2b087f05067c44d82ba907b3aaadb09ea84e73da
Pipeline SHA-256: 1e3046355a8c1596afed6477f3e9f01bdd8ade6d0a907669cb26b1d2daee41ee
Prompt SHA-256: fd913dd42fd9f8eaf07e4a9e244a2ce777ea9fe52dc987b8bec7d5ac38a62297

Waktu tiap laporan (UTC):
- gpt-4o-mini: 2026-10-25T10:19:39.731Z
- gpt-5.4-mini: 2026-10-25T10:26:37.374Z
- deepseek-v4-flash: 2026-10-25T10:30:17.046Z
