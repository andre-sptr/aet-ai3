# Panduan routing policy AETAI v2

Keadaan penyerahan: kode mekanisme diperbaiki, **tidak ada model baru yang dikalibrasi untuk produksi**, dan default `.env.example` tetap off. Baca `benchmark-routing-analysis.md` untuk matriks 96 sel dan batas bukti.

## Menjalankan hasil

Gunakan Node.js 24 dan dependency proyek sesuai lockfile. Jalankan dari root proyek:

```bash
npm ci
npx prisma generate
npm run test:routing
npm run test:adaptive
npm run routing:audit
npm run routing:retest:plan
npm run lint
npx tsc --noEmit
npm run build
```

Perintah audit/plan tidak mengakses provider dan tidak menimpa laporan. Normalizer tanpa `--check` memakai create-exclusive: untuk audit baru berikan `--out docs/benchmarks/nama-baru.json`. Pengujian mock memakai loopback/fixture. Perintah build/lint/TypeScript belum dapat dijalankan di lingkungan penyerahan karena dependency tidak dapat diunduh; hasil rinci ada pada `routing-validation.md`.

## Off, shadow dan adaptive

| Mode | Model aktual | Kebutuhan bukti |
| --- | --- | --- |
| off | Baseline yang kompatibel, sehat dan masih dalam budget | Tidak ada promosi; baseline tetap disaring |
| shadow | Baseline layak, sekalipun ada rekomendasi lain | Kandidat diperiksa seperti adaptive, tidak dikirim request tambahan |
| adaptive | Kandidat yang memenuhi policy; baseline layak jika bukti kurang | Policy v2 aktif, raw application evidence, perbandingan baseline sah, review dan biaya |

Konfigurasi awal:

```dotenv
AET_ROUTING_MODE="off"
AET_ROUTING_POLICY_FILE=""
```

Untuk mengamati tanpa mengganti model:

```dotenv
AET_ROUTING_MODE="shadow"
AET_ROUTING_POLICY_FILE="docs/routing-policy.pending.json"
```

File pending sengaja ditolak sebagai policy aktif. Metadata akan menunjukkan baseline belum terkalibrasi dan `insufficient_evidence`; tidak ada rekomendasi palsu. Mengubah mode menjadi adaptive saja tidak menciptakan bukti. `manualModelId`, field model klien, field evaluationCandidate klien, dan model Frontier pada payload tidak dapat memilih model server.

Jika baseline unhealthy/di luar kemampuan atau budget dan tidak ada alternatif terkalibrasi yang boleh dipakai, `modelId=null`, reason `no_eligible_model`; tahap generasi mengembalikan `NO_ELIGIBLE_MODEL`. Tidak ada pemilihan model acak. Respons deterministik aplikasi yang tidak memerlukan LLM tetap dapat diselesaikan.

## Mengapa schema v1 ditolak

V1 menerima beberapa angka policy tanpa sumber yang dapat diverifikasi. V2 merupakan descriptor referensi; loader menghitung ulang metrik, tidak menerima nilai `contextPassRate`, biaya, p95 atau skor komposit yang dideklarasikan policy. Jangan sekadar mengganti angka schemaVersion atau menyalin nilai screening ke v2.

Policy aktif memerlukan struktur berikut. Nilai referensi/hash adalah placeholder format, bukan konfigurasi siap produksi:

```json
{
  "schemaVersion": 2,
  "status": "active",
  "version": "routing-reviewed-v1",
  "dataset": {"ref": "tests/fixtures/routing-retest.json", "sha256": "<SHA256_BYTE_FIXTURE>"},
  "maxLatencyMs": 5000,
  "maxCostUsdPerRequest": 0.01,
  "evidence": [
    {
      "modelId": "gpt-4o-mini",
      "category": "reasoning",
      "persona": "daily",
      "complexity": "simple",
      "responseMode": "fast",
      "caseIds": ["reasoning-quantitative", "reasoning-constraints", "reasoning-conflicting-information"],
      "contextCaseIds": ["latest-correction", "early-constraint", "followup-second"],
      "report": {"ref": "evaluation/baseline/report.json", "sha256": "<SHA256_BYTE_REPORT>"},
      "review": {"ref": "evaluation/baseline/human-review.json", "sha256": "<SHA256_BYTE_REVIEW>"}
    }
  ]
}
```

Tambahkan satu descriptor kandidat terpisah dengan ID katalog yang tepat, scope dan kasus yang sama, dan report/review kandidat sendiri. Report berbeda boleh dibandingkan apabila dataset, fingerprint pipeline/persona, scope, kasus, pengulangan dan batas output sebanding. Baseline harus ada sebagai comparator valid, tetapi objektifnya boleh gagal dan biaya/review baseline boleh belum memenuhi ambang pemilihan. Kandidat tetap memenuhi seluruh ambang sendiri.

Angka 5000 ms dan USD 0,01 pada contoh adalah plafon operator, bukan hasil pengukuran atau rekomendasi biaya universal. Sesuaikan dengan kebutuhan aplikasi. Pemilihan kandidat yang sama-sama lolos mengutamakan objektif, konteks, instruksi, kualitas review, lalu latensi dan biaya; ID menjadi pemutus deterministik terakhir.

## Kontrak bukti aplikasi

Loader hanya menerima report **schemaVersion 2, kind application-evaluation, sourceKind live, planOnly false**, finishedAt valid, umur ≤7 hari, cap key-bound sah, dan fingerprint source/prompt sama dengan kode yang digunakan. Report screening 12×8, plan-only, mock, checkpoint dan v1 evaluator tidak dapat mengaktifkan promosi.

`scripts/evaluate-ai.mjs` sekarang mencatat request body provider tanpa header/secret, HTTP status, telemetry role/model/budget/usage, hash fixture byte, fingerprint kode aktual (termasuk perubahan working tree, dengan CRLF dinormalisasi), dan fingerprint persona dengan clock tetap. Fingerprint kode bukan tanda tangan gateway; file laporan dan review berada pada trust boundary operator. Model ID tetap hanya identitas yang dilaporkan gateway.

Untuk setiap descriptor diperlukan ≥3 kasus utama, ≥3 pengulangan berbeda untuk setiap kasus, dan kasus konteks pada persona yang sama. Satu case/repeat tidak boleh muncul dua kali. CaseId harus benar-benar terdapat pada fixture. Output akhir dan checks diverifikasi ulang terhadap validator bersama; status buatan tidak diterima. Persona dan kompleksitas kasus dihitung dari fixture dan harus cocok dengan scope. Teks dokumen tidak menjadi perintah routing.

V2 saat ini membatasi promosi ke role **answer** tanpa dokumen, gambar, tool evidence atau long-context. Hasil akhir harus berasal dari satu answer teridentifikasi; revisi yang mengubah asal jawaban tidak dipakai untuk menyimpulkan kemampuan role answer. Peran tambahan tetap menggunakan baseline dan budget induk, dan dicatat terpisah. Suite dan loader perlu diperluas secara eksplisit sebelum kemampuan tambahan boleh dipromosikan.

Nilai objektif dan konteks dihitung dari kasus yang relevan; streaming dihitung dari percobaan complete dengan ID model cocok, HTTP 200, dan parser produksi yang mensyaratkan stop. Request body dan estimasi input/cap harus cocok dengan telemetry. Panjang input diuji pada setiap pengulangan; kapasitas katalog bukan hasil uji long-context. Instruksi dan kualitas memerlukan review manusia terpisah, bukan tebakan otomatis.

Review terikat pada byte report dan fixture serta seluruh sample ID untuk model/scope itu:

```json
{
  "authorKind": "human",
  "status": "completed",
  "reviewer": "<IDENTITAS_REVIEWER_SEBENARNYA>",
  "reviewedAt": "<WAKTU_REVIEW_SEBENARNYA>",
  "reportSha256": "<SHA256_BYTE_REPORT>",
  "datasetSha256": "<SHA256_BYTE_FIXTURE>",
  "modelId": "<ID_MODEL_PERSIS>",
  "samples": [
    {"sampleId": "<SAMPLE_ID_DARI_REPORT>", "quality": 4, "instructions": 5}
  ]
}
```

Isi seluruh sampel relevan, bukan hanya yang lulus. quality/instructions 0–5; gunakan rubrik: 0 salah/tidak patuh, 1 sebagian besar bermasalah, 2 kekurangan besar, 3 memadai dengan kekurangan berarti, 4 kuat dengan kekurangan kecil, 5 memenuhi seluruh kriteria yang dinilai. Nilai instruksi dianggap lolos pada ≥4, lalu dihitung pass rate; mean quality harus ≥4. Review output/format, relevansi dan koreksi terhadap prompt, bukan reputasi model. Ini attestasi reviewer operator, bukan verifikasi identitas manusia otomatis. Penilaian AI tidak boleh diberi authorKind human. Pekerjaan ini tidak membuat review manusia produksi.

Biaya dihitung dari usage setiap percobaan × tarif gateway yang valid pada waktu sampling, termasuk role tambahan/retry. Usage hilang membuat biaya null dan costVerified false. `actualBilledCostUsd` tetap unknown. Saat mengaktifkan plafon USD runtime, tarif runtime resmi harus diverifikasi dalam 24 jam; `AET_MAX_REQUEST_USD` tanpa tarif gagal tertutup. Estimasi body, gambar dan usage bukan bukti billing provider.

## Evaluasi kandidat tanpa mengaktifkan policy produksi

Perintah berikut **hanya membuat rencana**, tanpa jaringan atau biaya:

```bash
npm run test:ai -- --candidate-model gpt-5.4-mini --fixture tests/fixtures/routing-retest.json --variants fast --repeat 3 --max-requests 18
```

Untuk memeriksa jalur software dengan fixture, tambahkan `--mock`. Hasil mock tidak dapat dipromosikan. Candidate dipilih melalui opsi internal evaluator server yang berlabel `evaluation_only`; tidak ada metrik policy sintetis yang dibuat untuk memaksa promosi. Endpoint HTTP tidak meneruskan opsi itu. Variante baseline lama tetap memakai baseline lama; untuk comparator Fast gunakan candidate-model gpt-4o-mini dan variants fast pada fixture yang sama.

Live belum diotorisasi dalam paket ini. Setelah pengguna mengotorisasi biaya baru secara jelas, operator harus memperbarui key khusus, cap provider yang benar-benar ditegakkan, tarif dan guard sesuai `AI_EVALUATION.md` sebelum menambahkan `--live`. Historical approved di report tidak berlaku untuk uji baru. Plafon generasi mencakup semua role/retry; jangan menyebut sel yang terblokir sebagai sampel selesai.

Shortlist retest publik: baseline, gpt-5.4-mini, deepseek-v4-flash. Jalankan satu run terpisah untuk setiap kandidat dengan fixture/mode/repeat sama dan output directory baru; jangan menimpa run lama. Scope coding/akademik, mode Normal/Think, dan kemampuan tambahan memerlukan kasus/kalibrasi sendiri. Jika gateway tetap tidak mengirim usage, bukti biaya tetap belum cukup untuk produksi.

Kandidat Frontier tetap membutuhkan ENABLE_FRONTIER=true dan token Frontier valid per percobaan. Evaluator membaca token hanya dari `AET_EVALUATION_FRONTIER_TOKEN` di environment lokal; jangan memasukkannya ke fixture, CLI literal, review atau report. Tanpa akses sah, request kandidat gagal sebelum fetch; tidak fallback ke model lain lalu diberi label kandidat.

## Inspeksi, telemetry dan rollback

`inspectRoutingPolicy(file)` adalah pemeriksaan read-only tanpa cache dan mengembalikan policy terverifikasi serta alasan penolakan yang ringkas. Runtime `loadRoutingPolicy` membatasi file policy 256 KB, report 8 MB, fixture 1 MB; path/hash/symlink diperiksa. Cache paling lama 30 detik per process, maksimal delapan path; restart untuk pencabutan segera. Data benchmark besar tidak diimpor ke browser atau dibaca per role.

Metadata akhir memuat model aktual, reportedModel, persona, responseMode, routing category/needs/complexity, policyVersion, calibration, baselineEligible, rejected reasons, stageRouting per role, dan budget telemetry. Metadata routing tidak berisi teks chat/dokumen/secret. Request body dicatat hanya oleh evaluator fixture operator, bukan log routing produksi. Header awal X-AET-Model menunjukkan keputusan awal; metadata SSE akhir dan attempts adalah sumber model yang benar-benar dipanggil apabila kondisi berubah sebelum answer/revision.

Tidak ada fallback lintas model sesudah kegagalan provider. Sebelum fetch, adaptive boleh memilih alternatif yang sudah terkalibrasi jika baseline tidak layak. Retry yang dipertahankan maksimal satu kali pada model yang sama untuk transport/5xx sebelum publikasi, dengan budget/deadline yang sama. Auth, billing, permission dan rate limit bersama tetap menghentikan jalur; mengganti model tidak menghapus cooldown key/gateway.

Rollback pemilihan model: set AET_ROUTING_MODE=off, kosongkan path policy bila perlu, lalu restart proses. Baseline tetap melewati pemeriksaan kesehatan/kemampuan/budget. Untuk rollback kode gunakan salinan source sebelum patch; jangan mengganti database, .env, upload atau histori pengguna. Daftar file yang boleh diterapkan ada pada manifest perubahan. Tidak ada migrasi database dalam perubahan ini.
