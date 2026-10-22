# Katalog model — audit ulang 22 Oktober 2026

Status percobaan terbaru: **BLOCKED oleh lingkungan**, bukan bukti bahwa model gagal atau telah ditarik provider. GET `/v1/models` menerima HTTP 403 dengan pesan `Forbidden. Calls to this URL are not allowed.` Tidak ada request generasi baru, sehingga tidak ada kemampuan/keunggulan model baru yang dinyatakan lulus.

Katalog mempertahankan 12 ID dan kebijakan akses asli. `availability`, `verification` dan capability yang sudah ada tetap merepresentasikan **bukti historis**; `verificationRecordedAt` dan `latestAudit` sekarang membedakan snapshot lama dari percobaan terbaru. Default `gpt-4o-mini` dipertahankan karena konfigurasi awal, bukan kemenangan benchmark baru.

| Model | Daily | Report | Coding | Reasoning (3) | Konteks/stream baru |
| --- | --- | --- | --- | --- | --- |
| `gpt-4o-mini` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `gpt-4.1-mini` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `gpt-5-mini` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `gpt-5.4-mini` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `gpt-5.4` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `claude-haiku-4-5` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `claude-sonnet-5` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `claude-opus-5` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `gemini/gemini-3.5-flash` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `gemini/gemini-3.1-pro-preview` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `deepseek-v4-flash` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `deepseek-v4-pro` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

Bukti baru: `docs/benchmarks/run-2026-10-22T03-28-12-368Z-ebdf5ad5/report.json` dan `AI_MODEL_BENCHMARK.md`. Setiap model memiliki delapan sel terencana; seluruh 96 sel memiliki `attempted=false`, skor tujuh dimensi `null`, output/usage/latency model `null`. Waktu preflight dicatat terpisah. `null` berarti belum dinilai, bukan gagal atau skor nol.

## Bukti historis yang tetap berlaku sebagai arsip

- `model-verification-final.json`: snapshot 22 Oktober 2026 01:27:22.548 UTC, 12 smoke teks/stream PASS menurut rekaman yang diunggah. Tidak dipakai sebagai hasil baru.
- `vision-verification-current.json`: GPT-4o Mini lulus fixture warna; GPT-4.1 Mini salah pada fixture tersebut. Gambar hanya tetap diaktifkan pada GPT-4o Mini. Model lain tidak diaktifkan berdasarkan nama provider.
- `model-gateway-metadata.json`: kapasitas konteks berasal dari metadata terdahulu, bukan stress test. Batas konteks aplikasi sendiri tetap konservatif.
- `benchmark-audit-final.json`: 120 respons baseline/optimized **hanya gpt-4o-mini** dan dua respons kebijakan sitasi. Ini tidak menilai kualitas semua 12 model.
- Katalog sebelum audit disimpan di `archive/AI_MODEL_CATALOG-before-full-audit.md`.

`supportsNativeTools`, `supportsReasoning` dan `relativeCost` tetap `unknown`. Tidak ada parameter reasoning/native tools baru yang dikirim; tidak ada vision baru. Kegagalan koneksi ini tidak dipromosikan menjadi `supportsStreaming=false` atau `availability=unavailable`.

Tier dan Frontier merupakan pengelompokan/kebijakan aplikasi, bukan peringkat kualitas. Verifikasi token, enable flag, limiter dan default Frontier off dipertahankan. Harness operator dapat menguji gateway langsung tanpa membuka endpoint Frontier untuk publik, hanya setelah guard biaya terpenuhi.

## Kompatibilitas dan risiko yang masih memerlukan uji nyata

Parser sekarang menolak terminasi tanpa `finish_reason=stop`, teks kosong, finish reason nonteks, dan model yang **secara eksplisit melaporkan ID berbeda**. Jika provider mengembalikan alias/snapshot ID, pemetaan alias harus dibuktikan terlebih dahulu; tidak diasumsikan setara. Tidak ada silent fallback. ID yang tidak dilaporkan tetap tidak dapat diverifikasi dan diberi INCONCLUSIVE oleh harness.

Parameter output produksi tetap `max_completion_tokens` untuk gpt-5*, `max_tokens` untuk keluarga lain, minimum Gemini 1024 sesuai rekaman lama. Kemampuan parameter ini belum diuji ulang ke gateway pada audit sekarang.

Dokumentasi resmi yang diperiksa: [API kompatibel OpenAI](https://docs.sumopod.com/guides/ai/openai-compatible-api) dan [pengaturan key serta credit limit](https://docs.sumopod.com/guides/ai/create-api-key). Halaman API tidak membuktikan dukungan parameter reasoning atau native tools. Tarif/token dan billing akun belum dapat diverifikasi.
