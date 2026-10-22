# Evaluasi kualitas respons — audit 2.1.1

Dataset tetap 60 prompt: 20 Smart Companion, 20 Academic Writer dan 20 Coding Expert, dengan konteks, batas faktual, tools yang diharapkan, kondisi gagal, dan rubrik 1–5 pada setiap kasus. Identitas serta prompt asli dipertahankan sebagai baseline. Bukti lama tetap tersedia sebagai arsip; bagian ini menjelaskan pengujian baru.

## Pengujian baru

- Model kedua versi sama: gpt-4o-mini, maksimum 768 output tokens, waktu acuan yang sama, paling banyak dua request serentak, tanpa auto retry.
- Final capture berisi 120 respons model (60 A + 60 B), seluruhnya finish_reason=stop, dengan total usage tercatat 124.182 token. Dua respons terkontrol sitasi ditambahkan sebagai versi production-policy; keduanya tidak memanggil model.
- Rekaman: benchmark-audit-final.json. Hasil objektif: benchmark-audit-objective.json. Review manusia/engineering sampel: benchmark-audit-manual-review.json.
- Satu capture awal menyimpan 119 dari 120 respons karena checkpoint bersamaan. Script diperbaiki agar snapshot dibentuk saat penulisan dan selalu menulis laporan final setelah antrian selesai. Pengujian final diulang, seluruh 120 respons tersimpan. Capture awal tidak digunakan sebagai bukti dataset lengkap.

| Mode | Baseline: batas objektif lulus | Optimized: prompt saja | Alur produksi dengan kebijakan sitasi |
| --- | --- | --- | --- |
| Smart Companion | 2/4 | 3/4 | 3/4 |
| Academic Writer | 1/3 | 2/3 | 3/3 |
| Coding Expert | 4/6 | 6/6 | 6/6 |
| Total subset | 7/13 | 11/13 | 12/13 |

Angka di atas hanya 13 batas objektif, bukan persentase peningkatan kecerdasan, bukan skor atas semua 60 prompt, dan bukan peringkat 12 model. Rubrik lebih luas diperiksa langsung pada 9 pasangan prompt (18 respons model) dan dua respons terkontrol; dimensi yang tidak dapat diamati diberi null. Review tidak blinded dan tidak independen.

## Temuan yang mendorong perubahan

1. Contoh APA berplaceholder masih dapat berubah menjadi jurnal, nama penulis dan DOI rekaan. Prompt saja belum cukup. Alur produksi sekarang menjawab permintaan contoh APA jurnal berplaceholder dengan format terkontrol dan menolak permintaan membuat DOI secara deterministik. DOI/sitasi lain tidak otomatis dijamin benar; pengguna tetap harus memeriksa sumber.
2. Permintaan 12 kata gagal pada kedua versi. Sistem tidak mengklaim menjamin jumlah kata persis. Permintaan rata-rata satu kalimat juga kadang menjadi dua kalimat meskipun angka 75 benar.
3. Konsep tanpa kode, output numerik saja, serta perbaikan Python lebih patuh pada subset optimized. Enam snippet Python terpilih telah dieksekusi dengan AST allowlist dan pemeriksaan terbatas; bukan semua kode respons.
4. Batas output kini memperhitungkan permintaan jumlah kata. Ini memperbaiki kesempatan model menyelesaikan esai, bukan jaminan panjang/akurasi model.

## Keterbatasan

Hanya satu pengulangan final, satu model kualitas, kondisi tool sebagian berupa fixture, dan cap output yang lebih rendah daripada beberapa permintaan produksi. Cuaca/kurs/scraper belum berhasil diverifikasi pada lingkungan ini; Tavily membutuhkan key sendiri. Tidak ada judge LLM atau klaim signifikansi statistik. Pengujian live aplikasi yang terpisah membuktikan jalur backend benar-benar mencapai Sumopod; lihat live-app-current.json.

Batas pengeluaran yang diizinkan pengguna adalah USD 3 pada key penyedia. Laporan mencatat jumlah request/token yang tersedia, bukan tagihan aktual yang sudah diverifikasi. Key tidak disimpan. Raw baseline/optimized memang memuat contoh buruk untuk kebutuhan audit; contoh tersebut bukan referensi yang boleh dipakai.
