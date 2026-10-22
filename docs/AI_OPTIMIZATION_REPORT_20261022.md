# Audit dan implementasi AI AET AI — 22 Oktober 2026

**Hasil utama:** cacat benchmark diperbaiki dan Smart Model Routing yang konservatif sudah diimplementasikan. **131/131 tes, lint, typecheck, build dan 84/84 pemeriksaan HTTP lulus.** Metadata Sumopod HTTP 200 memuat seluruh 12 ID yang diminta. **Generasi live belum dikirim**, sehingga belum ada dasar untuk menyimpulkan model mana lebih baik atau mengganti default.

Pengujian benchmark terakhir: 22 Oktober 2026, 11:58:24 WIB. Source implementasi: `c8e012a60889d5b5200106a0e47d572d5fe14ada`; dataset SHA-256: `5162b0e7f786b046ea927338bc25189c6125a1610563119f3199595f1e45b3bb`. Root source tetap `aetpcr/`. Root ZIP diperiksa, 220 file awal diinventarisasi, branch lokal terpisah dibuat dari snapshot. Tidak terdapat remote, perubahan pengguna di Git yang perlu digabung, deployment, push atau migrasi database.

## Status pekerjaan

| Kelompok | Status dan bukti |
| --- | --- |
| Berhasil dan diverifikasi | Instalasi lockfile, Prisma generate, 131 tes, lint, typecheck, build, 84 HTTP, patch harness, routing lokal dan gate keamanan |
| Gagal dengan bukti sebelum patch | Metadata menghalangi POST; urutan benchmark hanya memprioritaskan model awal; guard cap dapat dipakai key lain; diagnostik error terlalu umum |
| Terhalang prasyarat | Benchmark berbayar: cap provider pada key ini dan tarif input/output belum terverifikasi; QA browser: unduhan Chromium tidak valid |
| Belum diuji/belum konklusif | Kualitas semua model live, review persona live, latensi/biaya aktual, manfaat routing adaptif, QA visual desktop/mobile dan layanan eksternal produksi |

## Temuan dan perubahan yang dilakukan

| ID | Tingkat | Penyebab dan perbaikan |
| --- | --- | --- |
| A01 | HIGH | Metadata dijadikan syarat generasi. Kini advisory, termasuk HTTP 403 atau ID tidak tercantum. POST hanya memerlukan guard yang memang relevan. |
| A02 | MEDIUM | Loop model-major tidak berimbang. Kini smoke seluruh 12 ID terlebih dahulu, lalu round-robin per skenario dengan reservasi gelombang lengkap. |
| A03 | HIGH | Cap tidak terikat key aktual. Kini verifikasi SHA-256 key/gateway, tarif resmi, estimasi request aktual dan cadangan 20%. |
| A04 | MEDIUM | Body error dibuang. Kini diagnostic bounded/redacted dengan provider code dan kategori observasi; tidak menyimpulkan akar penyebab dari HTTP saja. |
| A05 | MEDIUM | Route menyamakan status upstream dan transport. Kini kode spesifik, abort/timeout dipisahkan, redirect ditolak dan provider text tidak bocor. |
| A06 | Fitur | Routing belum ada. Kini off/shadow/adaptive dengan classifier lokal, gate bukti live, pembanding default, manual override dan Frontier. |
| A07 | LOW | Plan lengkap exit 2. Kini dry-run exit 0, tetapi seluruh sel yang tidak diuji tetap BLOCKED. |
| A08 | LOW | Cakupan bobot belum formal. Kini bobot master, partial score dan coverage eksplisit; null tetap null. |

Detail sepuluh elemen per temuan—pemicu, reproduksi, akar masalah, file, tes, sebelum/sesudah dan risiko residual—tersedia di `AI_FINDINGS_20261022.json`. Log reproduksi kode awal disimpan. Perbaikan tambahan kecil: benchmark persona lama diserialkan menjadi concurrency 1, dan entrypoint berbayar lama turut memerlukan cap yang terikat key serta file tarif resmi.

File implementasi utama: `scripts/benchmark-all-models.mjs`, `scripts/benchmark-core.mjs`, `lib/ai/gateway-errors.ts`, `lib/ai/model-router.ts`, `lib/ai/routing-policy.ts`, `app/api/chat/route.ts`. Tes utama: `tests/benchmark-harness.test.mts`, `tests/model-routing.test.mts`, `tests/gateway-errors.test.mts`, `tests/chat-route.test.mts`. Perubahan lengkap ada pada `AI_CHANGES_20261022.patch`.

## Hasil benchmark dan batas biaya

Rencana 96 sel: 12 model × delapan skenario dengan ID dan jawaban acuan yang dipertahankan. Dua pemeriksaan metadata Sumopod dalam sesi ini masing-masing HTTP 200. Pada run final: **1 GET metadata, 0 POST generasi, 0 respons generasi selesai**. Semua 96 sel BLOCKED karena gerbang biaya, bukan FAIL model. Seluruh skor kualitas, latensi generasi dan penggunaan token per sel tetap null. Token generasi tercatat nol karena tidak ada request; angka tersebut bukan bukti tagihan aktual USD 0.

Tidak ada key di source, frontend, laporan, ZIP atau Git. Key hanya diberikan melalui environment proses, hanya ke `https://ai.sumopod.com/v1/models`; endpoint generasi belum dipanggil. Biaya USD aktual **tidak diketahui** karena tidak ada bukti billing. Dana USD 3 tidak diasumsikan sebagai cap provider hanya dari pernyataan nilai atau variabel environment.

Dokumentasi resmi Sumopod menjelaskan pengaturan credit limit per key dan base URL. Dokumentasi tersebut membuktikan adanya mekanisme konfigurasi, **belum membuktikan setting limit pada key ini**. Sumber resmi yang dibaca 22 Oktober 2026:

- [Creating an API Key](https://docs.sumopod.com/guides/ai/create-api-key)
- [Using the OpenAI-Compatible API](https://docs.sumopod.com/guides/ai/openai-compatible-api)

Belum ada tarif resmi untuk seluruh 12 model yang dapat dicatat secara bertanggung jawab dari bukti yang tersedia. Tidak ada harga, skor model atau tagihan yang dikarang. Hasil final penuh: `AI_BENCHMARK_FINAL_20261022.md`, `AI_BENCHMARK_RESULTS_20261022.json`, dan `docs/benchmarks/run-2026-10-22T04-58-24-893Z-5e2759da/report.json`.

## Cara melanjutkan live benchmark

1. Di dashboard resmi Sumopod, verifikasi key khusus benchmark memiliki credit limit yang benar-benar diberlakukan, maksimum USD 3. Simpan bukti setting, tanggal dan identitas key tersamarkan; jangan menyertakan key penuh atau data billing pribadi.
2. Buat file privat dari `docs/benchmark-budget.example.json` hanya setelah pengecekan itu. Isi attestasi, waktu, evidence, providerBaseUrl dan keySha256 dari **key yang sama**. SHA-256 membantu mengikat bukti ke key, bukan pengganti verifikasi provider.
3. Catat tarif resmi input/output per satu juta token untuk semua ID tepat pada file privat dari `docs/benchmark-pricing.example.json`, dengan sumber resmi dan waktu verifikasi <24 jam. Nilai null/contoh tidak mengizinkan live.
4. Set secret `SUMOPOD_API_KEY` di environment server; set `AET_LIVE_TEST_APPROVED=true`, `AET_TEST_BUDGET_USD=3`, `AET_BENCHMARK_BUDGET_FILE`, `AET_BENCHMARK_PRICING_FILE`, `AET_BENCHMARK_MAX_REQUESTS=12` untuk gelombang smoke pertama dan `AET_BENCHMARK_MAX_TOKENS=512`. Jangan memasukkan secret ke shell history publik, source atau berkas yang dibagikan.
5. Jalankan `npm run test:benchmark:plan`, kemudian `npm run test:benchmark` setelah seluruh guard terbukti. Harness memakai concurrency 1, retry 0, output limit aktual dari request builder (Gemini minimal 1024), estimasi konservatif, dan cadangan 20%. Cap provider tetap backstop absolut; estimasi lokal bukan jaminan tokenizer atau billing.
6. Tinjau output/persona secara manual dengan rubrik sebelum menarik kesimpulan. Jika smoke/budget masih layak, jalankan skenario sebanding untuk seluruh model; perhatikan pemakaian kumulatif key dari run terdahulu. Jangan menganggap run baru mereset limit provider.

Skrip memakai folder baru per run dan tidak menimpa hasil lama. HTTP 403 metadata tidak menghentikan POST yang sudah memenuhi guard. HTTP 401/402/403/429 pada generasi membuka circuit tanpa retry. HTTP 400/404/422 membatasi percobaan ID itu tanpa mengubah ID diam-diam. Timeout/error transport dicatat dengan status dan keterbatasannya.

## Persona, konteks dan routing

Komposisi prompt tiga persona, identitas/atribusi AET, model default, parameter generation keluarga model dan fixture jawaban acuan dipertahankan. Tidak ada perubahan persona berdasarkan dugaan kualitas. Tes lokal memverifikasi komposisi instruksi, koreksi terbaru dan batas dokumen tidak tepercaya; ini belum membuktikan bahwa setiap model live mematuhinya.

Routing default **off**. Manual selection selalu menang. Shadow hanya memberi rekomendasi lokal; adaptive memerlukan kandidat dan pembanding default pada skenario sama, bukti live terbaru, review manusia, konteks yang sudah diuji, biaya terverifikasi dan batas latensi. Laporan mock/plan ditolak. Tidak ada fallback atau classifier LLM tambahan. Tidak ada model unggulan per kategori yang ditetapkan sekarang. Kebijakan, kontrak record dan cara rollback ada di `AI_ROUTING_POLICY_20261022.md`.

## Preservasi, validasi dan risiko

Semua komponen, stylesheet, aset, schema/database SQLite, dependency/lockfile dan file autentikasi kritis identik secara SHA-256 dengan ZIP awal. Autentikasi, CMS, navigasi, rendering dan history tetap lolos cakupan unit/HTTP. Database asli tidak dipakai untuk mutasi tes. Laporan lama dipertahankan; contoh konfigurasi budget diperbarui sebagai konfigurasi, bukan hasil pengujian.

QA browser belum berjalan karena paket Chromium unduhan gagal diekstrak; layout final tidak diklaim sudah diamati. Sumber visual tidak diubah, tetapi kesamaan hash bukan pengganti visual QA. Biaya/latensi adaptif, kualitas relatif model, layanan eksternal dengan kredensial nyata dan beban multi-replica masih belum konklusif. Kebijakan review dan biaya tetap memerlukan operator tepercaya; gate file tidak menghubungi sistem billing otomatis.

## Setelah review pengguna

Paket ini belum dideploy. Pada lingkungan staging milik pengelola: isi secret privat, gunakan database yang sesuai, `npm ci`, `npm run postinstall`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, lalu jalankan aplikasi dan QA desktop/mobile. Pertahankan `AET_ROUTING_MODE=off` sampai bukti cukup. Jangan menimpa database produksi dengan database contoh dalam ZIP. Deployment/push baru dilakukan jika ada instruksi terpisah dari pengguna.
