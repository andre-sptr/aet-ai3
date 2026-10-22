# Perubahan optimasi AET AI — 22 Oktober 2026

- Metadata menjadi advisory; HTTP 403 dan ketiadaan ID tidak dianggap bukti model gagal.
- Benchmark smoke-first dan round-robin per skenario; reservasi gelombang seluruh model.
- Cap terikat key/gateway, tarif resmi wajib, cadangan estimasi 20%, pencatatan biaya tetap unknown tanpa billing.
- Diagnostic error provider dibatasi/disanitasi; error upstream lebih spesifik dan redirect ditolak.
- Smart Model Routing off/shadow/adaptive, manual override, gate live report, kualitas/konteks/Frontier/gambar/biaya/latensi; tanpa classifier LLM atau fallback.
- Rubrik berbobot dan cakupan skor parsial; dry-run valid exit 0 tanpa menandai model PASS.
- Benchmark persona legacy diserialkan; entrypoint live lama memerlukan guard tarif dan key binding.
- Tambah 15 tes (total 131); lint/typecheck/build/84 HTTP PASS.
- Metadata live 12/12 ID PASS; generasi 96/96 BLOCKED karena prasyarat biaya. Browser BLOCKED karena unduhan Chromium.
- UI, schema/database, auth, dependency dan default model tetap; seluruh laporan lama dipertahankan. Tidak ada deployment/push.
