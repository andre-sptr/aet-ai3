# Analisis benchmark dan perbaikan routing AETAI

Tanggal: 25 Oktober 2026. Masukan: `aet-aiv3(4).zip` dan `master-prompt-aetai-routing(1).md`. Seluruh benchmark yang diperlukan sudah ada dalam ZIP source; lampiran benchmark terpisah tidak diperlukan. Tidak ada `AGENTS.md` pada arsip maupun direktori induk kerja. Perubahan yang sudah ada pada source masukan dipertahankan.

## 1. Temuan dan keputusan

Run final selesai: **96/96 pasangan unik**, seluruhnya attempted, HTTP 200, dan ID model yang dilaporkan sesuai ID permintaan. Hasil: **64 PASS, 17 FAIL, 15 INCONCLUSIVE, 0 BLOCKED**. Ada **87 stop dan 9 length**. Status laporan FAIL berarti sebagian kasus gagal, bukan proses belum selesai. Identitas ini merupakan pelaporan gateway; backend model tidak diverifikasi secara independen.

Sebanyak 61 percobaan diwariskan tanpa perubahan dari checkpoint recovery; 35 sisanya dijalankan pada continuation. Total bukti tetap 96, bukan 157. Tidak ada usage pada 96 request, `recordedTokens=0`, `actualCostUsd=null`; penggunaan dan tagihan bukan nol. Throughput token dan penghematan biaya aktual tidak dapat dihitung.

Keputusan produksi: tidak ada model baru yang dipromosikan. Screening satu observasi per model/kasus belum memenuhi kalibrasi, review manusia, biaya berbasis usage, atau integrasi aplikasi. Perbaikan yang diserahkan memperbaiki mekanisme klasifikasi, validasi bukti, kelayakan baseline, parameter per model, anggaran, dan telemetry. Tidak ada klaim peningkatan persentase kecerdasan/kecepatan/biaya model.

## 2. Sumber otoritatif dan lineage

Sumber utama `docs/benchmarks/run-2026-10-25T07-48-50-786Z-6888c026/report.json`:

- `sourceKind=live`, `planOnly=false`.
- `finishedAt=2026-10-25T07:50:14.514Z`, yaitu 25 Oktober 2026 pukul 14.50.14 WIB.
- SHA-256 byte laporan: `35d450edbe0f9e1a329474e9614bf819dfc7dde3b38b851b3e86f15ca7e9fa0b`.
- Dataset canonical JSON: `5162b0e7f786b046ea927338bc25189c6125a1610563119f3199595f1e45b3bb`.
- Fingerprint persona benchmark: `2508e6d1a1ab0c71a3e092da243133463ebf65411089b80b769fa9f7ee6f2d3b`.

| Run, diawali `run-2026-10-25T` | Plan | Attempted | Stop | PASS / FAIL / INCONCLUSIVE / BLOCKED | Peran bukti |
| --- | --- | ---: | ---: | --- | --- |
| `06-28-44-466Z-3df6edcd` | ya | 0 | 0 | 0 / 0 / 0 / 96 | Rencana, tidak mengirim generasi |
| `06-32-28-311Z-763f4650` | ya | 0 | 0 | 0 / 0 / 0 / 96 | Rencana, tidak mengirim generasi |
| `06-34-06-323Z-dc0f7a72` | ya | 0 | 0 | 0 / 0 / 0 / 96 | Rencana, tidak mengirim generasi |
| `06-46-37-484Z-9a7a40fa`, `report.json` | tidak | 60 | 51 | 33 / 12 / 15 / 36 | Checkpoint belum final |
| run yang sama, `report.json.tmp` / `report-recovered.json` | tidak | 61 | 52 | 33 / 13 / 15 / 35 | Snapshot recovery, belum finishedAt |
| `07-48-31-653Z-fb5f2e77` | ya | 61 diwariskan | 52 | 33 / 13 / 15 / 35 | Plan resume; 0 generasi baru |
| `07-48-50-786Z-6888c026` | tidak | 96 | 87 | 64 / 17 / 15 / 0 | Final, 35 generasi baru |

`report.json.tmp` dan `report-recovered.json` setara secara struktural. Hash byte recovery adalah `f95f2d66d08fee495e5aef560fc28ab91b7d0d5c219ea5c55494151f17e8fddd`; hash itu cocok dengan `resume.sourceSha256`. Path Windows `resume.sourceFile` dipetakan ke file yang memang ada, bukan diganti dengan checkpoint 60 sel. `retainedAttempts=61`, `pendingAtStart=35`, dan semua 61 objek baris inherited sama secara deep equality dengan final.

Markdown final sejalan dengan JSON final. Markdown checkpoint 60 sel masih berjudul INCONCLUSIVE, sedangkan JSON checkpoint mempunyai baris FAIL; headline keseluruhan checkpoint belum diperbarui sampai penyelesaian run. Karena itu headline Markdown lama tidak dipakai menggantikan status per baris. Nilai null tidak diubah menjadi nol. Sel plan-only yang membawa hasil resume ditelusuri ke sumbernya, bukan dianggap generasi baru.

Revisi final tercatat `46f717452f7ba0652bc977263bc42bdea5c5f38e`; sumber inherited mencatat `ea420c1d1ec301d389270b4b8655cc4090c2ddaa`. Objek kedua commit ada dalam arsip. Perbandingan Git untuk harness/persona/config yang relevan antara kedua commit tidak menunjukkan perubahan substantif. Namun source masukan mempunyai perubahan recovery yang belum tercatat pada HEAD: `benchmark-all-models.mjs` menambah resume, claim, penyimpanan snapshot, penghitung dan scheduling; `benchmark-recovery.mjs` beserta tesnya tersedia. Karena itu Git HEAD saja tidak membuktikan seluruh source yang dieksekusi. Audit membangun ulang semua body request dengan fixture, persona, clock asli dan konfigurasi aktual source, dan semuanya cocok. Ini memvalidasi kompatibilitas request, bukan pembuktian independen proses di komputer operator.

`legacyKeyBinding=true` karena laporan lama tidak memiliki fingerprint key historis. Kesamaan key lama tidak dapat dibuktikan; tidak ada klaim bahwa key tersebut telah diverifikasi ulang. Attestasi cap/pricing lama tidak memberikan otorisasi uji berbayar baru.

Seluruh byte laporan live, Markdown, checkpoint, recovery dan claim dipertahankan. `docs/benchmarks/routing-screening-20261025.json` merupakan turunan audit, bukan pengganti laporan. Inventaris di dalamnya memuat hash semua sumber. `npm run routing:audit` memeriksa ulang turunan, lineage, dataset, request dan validator tanpa jaringan.

## 3. Matriks 12 model

P = PASS; F = FAIL; I = INCONCLUSIVE. Setiap sel berisi **satu** observasi. Kolom mengacu berurutan pada caseId `persona-daily`, `persona-report`, `persona-coding`, `reasoning-quantitative`, `reasoning-constraints`, `reasoning-conflicting-information`, `context-latest-correction`, `stream-smoke` dalam laporan final di bagian 2. ID model dipertahankan persis dari katalog.

| Model | Daily | Report | Coding | Kuantitatif | Kendala | JSON konflik | Koreksi | Stream |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gpt-4o-mini` | I | I | P | F | F | F | P | P |
| `gpt-4.1-mini` | I | I | P | F | P | F | P | P |
| `gpt-5-mini` | F | F | P | P | P | P | P | P |
| `gpt-5.4-mini` | I | I | P | P | P | P | P | P |
| `gpt-5.4` | I | I | P | P | P | P | P | P |
| `claude-haiku-4-5` | I | I | P | F | P | F | P | P |
| `claude-sonnet-5` | I | I | P | P | P | F | P | P |
| `claude-opus-5` | I | F | P | P | P | P | P | P |
| `gemini/gemini-3.5-flash` | I | F | P | P | P | P | P | P |
| `gemini/gemini-3.1-pro-preview` | F | F | P | P | P | P | P | P |
| `deepseek-v4-flash` | I | F | P | P | P | P | P | P |
| `deepseek-v4-pro` | F | F | P | P | P | P | P | P |

Referensi tepat setiap sel, latensi, parameter, batas output dan cakupan dimensi tersimpan pada `models[].cases[]` di audit turunan. Tidak ada peringkat komposit antarjenis tugas atau antar-provider.

| Kasus | Sampel | P / F / I | Temuan objektif dan batas keyakinan |
| --- | ---: | --- | --- |
| Streaming | 12 | 12 / 0 / 0 | Exact `AET OK`, stop dan identitas reported match. Tinggi untuk catatan observasi ini; rendah untuk keandalan produksi jangka panjang. |
| Daily | 12 | 0 / 3 / 9 | 9 memenuhi validator dua poin/20–45 kata/tanpa salam; review kualitas belum dilakukan. Tiga length. |
| Report | 12 | 0 / 6 / 6 | 6 memenuhi check paragraf, kata, korelasi/perancu dan tanpa sumber buatan. Argumen ilmiah belum mendapat review manusia; enam length. |
| Coding | 12 | 12 / 0 / 0 | Fungsi `last()` cocok grammar aman dan lolos tujuh contoh array. Tidak membuktikan debugging kompleks. |
| Kuantitatif | 12 | 9 / 3 / 0 | Jawaban benar 154000. Tiga jawaban salah, bukan masalah koneksi. |
| Kendala | 12 | 11 / 1 / 0 | Solusi unik diverifikasi enumerasi fixture; baseline memberi jadwal salah. |
| JSON konflik | 12 | 8 / 4 / 0 | Empat gagal raw JSON; semantik nilai objek terpisah sesuai. Tidak membuktikan kemampuan ketidakpastian umum. |
| Koreksi konteks | 12 | 12 / 0 / 0 | Nilai koreksi 900000 dipertahankan dalam percakapan singkat. Tidak membuktikan long context. |

Tidak ada sampel untuk vision baru, native tool calling, planner/worker/verifier/revision, dokumen panjang, konteks panjang, variasi bahasa luas, atau tugas akademik/coding kompleks. Statusnya tidak diuji, bukan FAIL dan bukan PASS. Keyakinan generalisasi rendah karena tidak ada pengulangan independen.

### Audit jawaban dan validator

Empat jawaban salah terukur:

- `gpt-4o-mini` / `reasoning-quantitative`: 132000, referensi 154000.
- `gpt-4.1-mini` / kasus yang sama: 142000.
- `claude-haiku-4-5` / kasus yang sama: 166000.
- `gpt-4o-mini` / `reasoning-constraints`: `A=Selasa; B=Senin; C=Rabu`, melanggar batasan. Referensi `A=Senin; B=Rabu; C=Selasa`.

Empat kegagalan `reasoning-conflicting-information` pada `gpt-4o-mini`, `gpt-4.1-mini`, `claude-haiku-4-5`, `claude-sonnet-5` mempunyai `status=tidak_dapat_dipastikan` dan `persentase=null` setelah pagar Markdown dihapus untuk audit semantik saja. Output asli melanggar instruksi JSON mentah; validator dan FAIL asli tidak diubah. Pemeriksaan semantik terpisah dicatat pada `failures[].semanticJsonMatches`, tanpa skor manusia atau promosi.

Sembilan length: daily pada `gpt-5-mini`, `gemini/gemini-3.1-pro-preview`, `deepseek-v4-pro`; report pada `gpt-5-mini`, `claude-opus-5`, kedua Gemini, dan kedua DeepSeek. Enam output kosong, tiga output parsial. Semuanya gagal pada konfigurasi tersebut. Penyebab internal model tidak diketahui dan tidak disimpulkan dari output kosong.

`requestedOutputCap=512` bukan batas aktual seragam: GPT-5 memakai `max_completion_tokens=512`; dua Gemini memakai `max_tokens=1024`; model lainnya memakai `max_tokens=512`. Perbandingan lintas keluarga harus menyebut perbedaan ini. Tidak ada temperature, reasoning_effort atau native tools yang diuji. Retest menaikkan cap secara eksplisit, tanpa mengubah laporan lama.

Rubrik exact dan JSON adalah validator sempit; kata kunci report tidak membuktikan kualitas argumen atau kebenaran sitasi. Grammar fungsi kode membatasi seluruh program sebelum tujuh contoh dieksekusi, sehingga teks model tidak menjadi perintah bebas. Review kualitatif tidak diisi dalam pekerjaan ini.

`partialComposite.weightCoverage`: smoke/coding 0,30; daily/report 0,05; kuantitatif/kendala 0,50; konflik 0,60; koreksi 0,45. Skor 5 dengan coverage 0,05 bukan kualitas total 5/5. Tidak ada pemeringkatan dari skor-skor berbeda cakupan tersebut.

### Latensi reasoning yang tersedia

Masing-masing angka berikut adalah satu observasi ms, bukan p95 atau klaim keunggulan stabil. Parameter keluarga berbeda sebagaimana dijelaskan di atas.

| Model | Kuantitatif | Kendala | JSON konflik |
| --- | ---: | ---: | ---: |
| gpt-4o-mini | 3655 | 946 | 1181 |
| gpt-4.1-mini | 708 | 846 | 825 |
| gpt-5-mini | 4186 | 3986 | 3288 |
| gpt-5.4-mini | 915 | 1541 | 1526 |
| gpt-5.4 | 1092 | 816 | 1013 |
| claude-haiku-4-5 | 805 | 946 | 950 |
| claude-sonnet-5 | 1495 | 2498 | 1222 |
| claude-opus-5 | 1289 | 1718 | 1991 |
| gemini/gemini-3.5-flash | 3351 | 4158 | 3914 |
| gemini/gemini-3.1-pro-preview | 3799 | 6461 | 6832 |
| deepseek-v4-flash | 1271 | 1594 | 1368 |
| deepseek-v4-pro | 3373 | 7101 | 4205 |

Tarif gateway yang tercatat adalah attestasi operator pada 25 Oktober 2026 13.45.50 WIB; bukan tagihan dan bukan kutipan harga yang dijamin tetap berlaku. Estimasi konservatif dipisahkan dari biaya berbasis usage dan billing aktual.

## 4. Alur produksi dan masalah yang terbukti

`POST app/api/chat/route.ts` memvalidasi origin, limiter, payload dan lifecycle; `validateChat` mempertahankan persona `daily/report/coding` serta response mode `fast/normal/think`. `createOrchestrator` membangun state dari branch valid, menganalisis tugas, mengambil policy server, menyusun bukti/context packet, lalu melakukan tahap yang diperlukan. `generateText` membangun parameter keluarga, mengecek akses/kesehatan, mereservasi budget, mengirim SSE provider dan memvalidasi stop/identity. Draft dibuffer; hanya hasil akhir yang diterbitkan sebagai delta. Stop/abort/deadline dan semua peran berbagi budget induk.

Persona menentukan gaya/instruksi, response mode menentukan strategi/batas pemrosesan, kategori menggambarkan maksud tugas, dan role adalah answer/planner/worker/verifier/revision. Keempatnya bukan nama lain dari model tertentu.

| Masalah yang terbukti pada source masukan | Fungsi asal | Perbaikan |
| --- | --- | --- |
| Dokumen atau 24000 karakter langsung mengganti kategori menjadi long-context sebelum coding/report diperiksa | `classifyTask` | Maksud tugas dipertahankan; kebutuhan dokumen/gambar/long context terpisah |
| Kandidat tidak bisa dipromosikan jika baseline gagal kualitas | `routeModel`, baseline dicari dari kandidat yang lolos seluruh gate | Comparator valid tidak harus menjadi pilihan berkualitas; kandidat tetap lolos seluruh gate sendiri |
| Loader hanya mencocokkan subset metrik dan memakai panjang input maksimum sebagai klaim kecakapan konteks | `hasLiveEvidence` lama | Kontrak v2 merekonstruksi metrik dari sampel aplikasi, fixture dan review berhash; long context tidak diinferensikan |
| Nilai context/instruction/review/latency/cost/comparisonSet dapat hanya dideklarasikan policy | `loadRoutingPolicy` lama | Metrik numerik tidak diambil dari deklarasi policy; output dan checks dihitung ulang, review/cost/provenance direkonsiliasi |
| Baseline selalu dikembalikan meskipun unhealthy, gambar tidak kompatibel atau budget tidak cukup | jalur `base` pada `routeModel` | Pemeriksaan baseline berlaku di off/shadow/adaptive; tanpa pilihan layak hasilnya `no_eligible_model` |
| Setiap role dirouting ulang dari subgoal dan memakai system/packet/generation config dari model awal | `call`, `makePacket`, `metadata` | Intent pengguna tetap menjadi input routing; role discope; system/config/budget diperiksa untuk model panggilan yang aktual, final metadata mengikuti answer/revision |
| Bukti/reports dibaca ulang untuk setiap policy load | loader lama | Cache bounded 30 detik dan reuse file dalam satu inspeksi; bukti besar tidak masuk browser |

Tidak diklaim ada bug pada autentikasi, data pengguna, billing nyata atau SSE di luar jalur yang diperiksa. Classifier/state masih heuristik, bukan pemahaman semantik sempurna. Keyword eksplisit terbaru didahulukan; follow-up dan koreksi mengambil konteks tugas pengguna, bukan teks dokumen atau subgoal model.

## 5. Kebijakan sebelum dan sesudah

| Kebutuhan | Sebelum | Sesudah dan status produksi |
| --- | --- | --- |
| Daily/akademik/coding biasa | Baseline tanpa kalibrasi kategori | Baseline layak; kandidat tetap pending karena 1 kasus/kategori dan review/usage kurang |
| Reasoning | Baseline; promosi buntu jika baseline gagal | Comparator baseline boleh gagal; kandidat harus terkalibrasi menurut persona, kompleksitas, mode dan input. Belum ada kandidat produksi |
| Dokumen + coding/report | Kategori long-context | Kategori coding/akademik, `documents=true`; tidak mempromosikan model dari screening text-only |
| Input besar/gambar/tools | Baseline tidak disaring di router | Capability, kapasitas, kesehatan dan budget disaring. Bukti text-only tidak mengizinkan promosi cakupan tambahan |
| Planner/worker/verifier/revision | Bisa menerima kandidat dari kategori chat biasa | Bukti v2 saat ini khusus answer; role lain tetap baseline layak atau gagal/skip tahap opsional secara jelas |
| Baseline unhealthy | Tetap dicoba | Adaptive dapat memilih kandidat terkalibrasi; tanpa kandidat tidak fetch. Shadow hanya memberi rekomendasi dan tidak berpindah |
| Auth/billing/shared rate limit | Tidak boleh dihindari dengan rotasi | Tetap tidak ada rotasi; shared cooldown dan retry model yang sama dipertahankan |

Tabel kandidat untuk produksi saat ini sengaja tidak menunjuk pemenang: utama `gpt-4o-mini` bila layak; cadangan lintas model **belum tersedia**. `gpt-5.4-mini` dan `deepseek-v4-flash` hanya shortlist retest publik untuk reasoning berdasarkan tiga sel yang ada, latensi observasi dan tarif tercatat. Frontier tetap memerlukan flag dan token server; nama/tier tidak menjadi bukti kelayakan.

V2 mempertahankan minimum kualitas 0,90 objektif/konteks/instruksi, streaming 1,00, review manusia ≥4/5, batas latensi/biaya operator dan umur bukti tujuh hari; menambah ≥3 kasus utama dan ≥3 pengulangan independen setiap kasus. Ini minimum kontrak awal, bukan jaminan statistik. Scope mencakup persona, kompleksitas, response mode, role answer, input/output aktual; dokumen/gambar/tool evidence/long context tidak ikut dipromosikan.

## 6. Implementasi, pengujian dan operasional

Daftar perubahan lengkap tersedia di `docs/routing-change-manifest.json`; penjelasan operasional pada `docs/routing-policy-guide.md`. Tidak ada UI/identitas visual, schema database, histori, autentikasi, atau isi benchmark live yang diubah. Database lokal dari arsip tidak dibundel sebagai source hasil; salinan deployment pengguna dipertahankan saat menerapkan patch.

Lihat `docs/routing-validation.md` untuk perintah, hasil dan keterbatasan lingkungan. Tes sintetis memverifikasi logika, bukan kemampuan model nyata atau persetujuan manusia. Tidak ada generasi live berbayar baru. Native build/lint/full TypeScript menunggu dependency yang tidak tersedia melalui jaringan lingkungan ini.

Default tetap `AET_ROUTING_MODE=off`. Shadow menghitung rekomendasi tanpa panggilan kandidat tambahan. Adaptive menerima hanya policy v2 aktif dengan bukti terkalibrasi; file pending yang disertakan tidak aktif. Rollback segera ke off dan restart proses bila perlu mengosongkan cache policy. Perubahan schema v1 ke v2 adalah perubahan kontrak yang sengaja fail-closed; lihat panduan untuk migrasi.

## 7. Rencana retest

`docs/routing-retest-plan.json` berstatus `PLAN_ONLY_NOT_AUTHORIZED`. Rencana mencakup 54 diagnostik truncation (9 sel × 2 cap × 3), 24 pengulangan delapan kegagalan objektif/format (8 × 3), serta plafon 54 generasi aplikasi Fast untuk baseline dan dua kandidat publik (6 kasus × 3 × 3 model). Tiga kasus utama reasoning dan tiga kasus konteks tersedia di `tests/fixtures/routing-retest.json`.

Dengan tarif historis yang tercatat: estimasi direct USD 1,2741834; aplikasi konservatif USD 0,9828864; total perencanaan USD 2,2570698. Estimasi aplikasi memakai cadangan 24000 input dan 4096 output per percobaan, bukan usage aktual. Nilai ini berada di bawah plafon lokal historis USD 2,40 dari cap provider USD 3, tetapi bukan izin belanja atau jaminan billing. Retry mengambil dari plafon yang sama dan dapat mengurangi jumlah sampel selesai. Tarif, sisa saldo/cap key, otorisasi baru, dan guard harus sah saat eksekusi.

Kemampuan yang belum tercakup—penulisan akademik luas, debugging kompleks, dokumen/gambar, tool evidence, konteks panjang dan role tambahan—memerlukan suite terpisah dengan kasus setara, pengulangan, review dan biaya terukur. Jangan mempromosikannya dari rencana reasoning ini. Jika usage tetap tidak dilaporkan gateway, promosi berbasis biaya tetap tertahan; jangan mengisinya dengan nol atau estimasi yang diberi label biaya nyata.
