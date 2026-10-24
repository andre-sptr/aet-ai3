# Validasi aktual — 24 Oktober 2026

Masukan: ZIP aet-aiv3, HEAD 0147f5b9b3ab0073bfce05ca79a38f2cc6a04563. Runtime Node.js 24.22.1. Tidak ada push, deployment, reset database atau pengujian provider berbayar. Semua hasil di bawah membedakan simulasi, inspeksi statis dan live.

## Hasil pemeriksaan

| Pemeriksaan | Hasil aktual | Bukti/batas |
| --- | --- | --- |
| Inspeksi source dan commit | Lulus | Lima temuan awal terkonfirmasi, 12 ID katalog ada; AGENTS.md tidak ditemukan; docs historis tidak disertakan. |
| npm ci (offline dan jaringan) | Terblokir | Cache tidak tersedia, registry mengembalikan HTTP 403 untuk zwitch. |
| npm run test:adaptive | **103/103 lulus** | 0 gagal, 0 dibatalkan, 0 skipped. Gateway simulasi dan state lokal. |
| npm test seluruh repo | **161 lulus; 7 gagal dari 168** | Kegagalan terkait dependency yang tidak terpasang; suite keseluruhan tidak dinyatakan lulus. |
| Parse sintaks TS/TSX/MTS/MJS | **123 berkas, 0 error** | Parser Babel bawaan runtime Playwright. Bukan semantic TypeScript, lint atau build. |
| npm run lint | Terblokir | eslint: not found. |
| TypeScript --noEmit | Terblokir | Compiler tidak terpasang; percobaan npm exec offline gagal. |
| npm run build | Terblokir | next: not found. |
| npm run test:http | Terblokir | Skrip dicoba; belum ada .next/BUILD_ID. Regresi HTTP di server production belum berjalan. |
| QA browser desktop/mobile | Belum dijalankan | Aplikasi belum dapat dibangun/dijalankan. Radio/UI hanya diperiksa secara statis. |
| Evaluasi --plan | Lulus sebagai rencana | 120 sel NOT_RUN, 0 generasi, tidak ada skor live. |
| Evaluasi --mock 3 pengulangan | Selesai | 120 sampel, 126 generasi simulasi; 105 PASS, 12 REVIEW_REQUIRED, 3 FAIL kontrol baseline. |
| Provider nyata / benchmark berbayar | Belum dijalankan | Key, cap provider, dan tarif terverifikasi untuk pekerjaan ini tidak disediakan. |

Tujuh failure entry suite lengkap adalah: AET retrieval (mammoth), ekstraksi PDF valid, penolakan PDF scan/encrypted/too-many-pages (pdf-parse), ekstraksi DOCX (mammoth), dan file tes rendering (react dan dependency Markdown/KaTeX belum terpasang). Tes dokumen tidak diubah menjadi skipped/pass untuk menyembunyikan kegagalan import. File rendering tidak sempat menjalankan seluruh tes di dalamnya. Log lengkap ada di validation/full-tests.log.

## Cakupan regresi yang lulus

- Seluruh sembilan kombinasi persona/mode; Normal default; payload/riwayat lama; pemilihan model server; field model klien tidak dapat melewati gate Frontier.
- Budget bersama seluruh role dan retry, reservasi token/biaya, tool/revisi, per-request/global concurrency, deadlining, serta penggunaan unknown tetap null.
- Worker selektif dua paralel, pembatalan keduanya, draft tidak dipublikasikan, verifier advisory, satu revisi terarah dan tidak ada loop.
- Koreksi di luar 40 pesan, asal/revisi state, pertanyaan tentang nilai sekarang, acuan kedua ambigu, edit/hapus/tombstone, pergantian chat dan ticket request usang.
- JSON-only, DOI/URL tidak didukung, failed-source provenance, dokumen sebagai data tak tepercaya, grammar aritmetika tanpa eval, SSRF dan URL aktif.
- Metadata model/usage, model berbeda, jawaban kosong, stream terputus, stop, cancellation saat menunggu read, shared quota dan Retry-After tanpa rotasi kandidat.
- Harness plan/mock/live-terblokir, matriks identik, pembatasan generasi global, review manual dan pelaporan kontrol negatif.

## Evaluasi, hasil negatif, dan trade-off

Hasil LOCAL_MOCK menguji jalur perangkat lunak, bukan kemampuan model. Baseline sengaja kehilangan kode lama di luar 40 pesan; stub kemudian mengeluarkan 0. Tiga FAIL tersebut adalah kontrol negatif satu kasus × tiga pengulangan, bukan bukti bahwa provider nyata memberi nilai itu. Tiga mode baru masing-masing memenuhi 27 syarat objektif sempit dari 27 sampel objektif pada fixture; 12 penilaian perbandingan tetap memerlukan manusia. Ini tidak membuktikan peningkatan kualitas, factual entailment, keamanan prompt injection secara umum atau kualitas kode arbitrer.

Run simulasi pertama disimpan dalam evaluation-mock-throughput-control: 120 sampel dengan limiter 120/menit pada batch yang dipercepat menyebabkan tiga error tambahan. Run akhir menaikkan limiter menit pada proses mock saja menjadi 10.000; budget per request tetap produksi. Bukti lama tidak dihapus. Produksi tetap memakai default 120/menit dan mekanismenya diuji terpisah. Lihat simulationOverrides pada report akhir.

Latensi p50/p95 dalam laporan mock hanyalah waktu CPU/IO simulasi, tidak dapat dibandingkan sebagai latensi model/gateway. Token 100/20 pada fixture adalah usage simulasi. Tarif mock juga fixture, bukan tarif resmi. Tagihan aktual null. Belum tersedia evaluasi live kualitas, latensi dan biaya, sehingga routing tetap belum dikalibrasi dan baseline dipertahankan.

Buffered publication menunda token jawaban pertama demi menahan draft hingga pemeriksaan selesai. Think pada tugas kompleks dapat menambah waktu/biaya dan tetap dapat gagal. Budget/deadline bisa menyebabkan tahap tambahan dilewati. Ekstraksi state/relevansi heuristik dan reservasi token gambar belum dikalibrasi; detailnya pada ADAPTIVE_ARCHITECTURE.md. Belum ada klaim bebas halusinasi atau keunggulan suatu kandidat.

## Integritas dan konfigurasi lanjutan

Database SQLite, schema Prisma, dokumen resmi AET, modul auth, mekanisme token AET, endpoint upload dan parser lampiran asli **identik byte demi byte** dengan ZIP masukan. SHA-256 ada di validation/validation.json. Graph dependency package-lock tidak diubah; hanya nomor versi root 2.2.0 dan package scripts yang diperbarui.

Untuk verifikasi akhir setelah jaringan dependency tersedia: npm ci, prisma generate, seluruh tes, lint, semantic TypeScript, build, HTTP sesudah build, lalu QA desktop/mobile. Isi environment server, tarif/cap bila menjalankan live, dan batas hosting sebenarnya. Baca AI_EVALUATION.md untuk pilot kecil serta berkas hasil yang dapat diunggah kembali.

## Berkas utama dan penyerahan

Mode policy, budget, provider, health, context/state, task analysis, structured JSON, verification dan orchestration berada di lib/ai. Route menjadi penghubung layanan/SSE. UI mode dan status ada di ChatInterface serta MessageBubble. Migrasi lokal ada di conversations dan parser stream di chat-stream. Skrip baru evaluate-ai.mjs dan setup-ai-evaluation.mjs, fixture evaluasi, tes adaptive/route/evaluation, README dan panduan disertakan.

ZIP hasil merupakan source yang benar-benar diedit, bukan usulan prompt. Patch dari ZIP masukan disertakan untuk diterapkan pada checkout sendiri. Status implementasi source selesai dengan verifikasi production/live yang masih tertunda sebagaimana tabel; bukan klaim siap deploy berdasarkan mock saja.
