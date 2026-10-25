# Peningkatan AET AI — 25 Oktober 2026

Patch ini memperbaiki integrasi aplikasi, kontrak keluaran dan pelaporan. Peningkatan kualitas model live belum dibuktikan oleh pekerjaan offline ini. Tidak ada benchmark berbayar, deployment, perubahan bobot provider, atau review manusia yang dibuat oleh AI.

## Temuan yang diperiksa dari byte sumber

Laporan `docs/benchmarks/run-2026-10-25T11-17-41-534Z-6f4ddf0d/report.json` mempunyai SHA-256 `782091c2b0eabe5290ad01b472a24759e4cbff3db08f9e7a85e44cb0fc5bfc03`, sesuai master prompt. Sebanyak 96 pasangan model/kasus unik mendapat HTTP 200 dan identitas gateway yang cocok; 87 selesai `stop`, sembilan `length`. Status historis tetap 63 PASS, 15 INCONCLUSIVE, 18 FAIL. Dari respons lengkap, 78 lulus objektif dan sembilan gagal (tiga aritmetika, satu jadwal, lima format JSON). Identitas yang dilaporkan gateway tidak mengautentikasi model dasar provider.

Seluruh request dapat direproduksi melalui builder produksi dan seluruh 87 penilaian objektif respons lengkap cocok dengan validator historis. Tabel 12 model, dimensi baru, audit dan bukti aplikasi tambahan tersedia di [analysis/analysis.md](analysis/analysis.md); data mesin di [analysis/analysis.json](analysis/analysis.json). Pengecekan ini membuktikan konsistensi artefak operator, bukan asal-usul respons provider secara independen.

Usage lengkap diketahui untuk 23/96 request (73 tidak diketahui), dengan 24.435 token tercatat. USD 1,19248108 adalah reservasi estimasi batch; USD 0,01145580 adalah subtotal usage yang diketahui × tarif operator. Biaya total dan tagihan aktual tetap `null`.

## Diagnosis dan perubahan

| Prioritas | Bukti kode dan tindakan | Batas kesimpulan |
| --- | --- | --- |
| P0 | `parseOpenAITextStream` sebelumnya langsung melempar saat `length`; sekarang mempertahankan kegagalan dan mencoba membaca metadata selama maksimal 500 ms/64 KiB, dengan batas mutlak konfigurasi 1 detik/64 KiB serta abort/deadline induk. | Ini memungkinkan trailing usage ditangkap jika dikirim; tidak membuktikan bahwa provider pernah mengirimkannya pada laporan lama. |
| P0 | `StreamFailure.code` membedakan truncation, model mismatch, malformed frame, EOF, filter, finish yang tidak didukung dan ukuran berlebih. Attempt provider mencatat HTTP, finish, drain, alasan usage hilang dan kode error; timeout/abort/billing/auth/rate-limit tetap terpisah. | Partial output tetap gagal. Tidak ada retry otomatis akibat `length` atau publikasi draft sebagai jawaban selesai. |
| P0 | `output-contract.ts`, `checkAnswer` dan orkestrasi mengenali `JSON saja`, `hanya JSON`, angka dan kode mentah yang eksplisit. Kontrak yang gagal setelah proses terbatas menghasilkan `QUALITY_CONTRACT`, tanpa membuat JSON status dengan schema yang tidak diminta. Koreksi format terbaru mengalahkan format lama. | Pemeriksaan ini sempit: JSON parse bukan validasi seluruh schema pengguna; pemeriksaan kode mentah bukan bukti program benar. Soal cerita dan jadwal tidak otomatis menjadi benar. |
| P0 | Kalkulator yang sudah ada tetap memakai grammar aritmetika terbatas. Sufiks angka saja kini diterima untuk ekspresi eksplisit; larangan tool, teks penjelasan dan soal cerita tidak diubah menjadi kode yang dieksekusi. | Tidak ada jawaban benchmark yang di-hardcode pada runtime. |
| P1 | Telemetry menampilkan cakupan usage/biaya dan subtotal bagian yang diketahui. Alasan hilang dibatasi pada bukti: tidak diminta, stream yang teramati tidak mengirim, stream terputus, pembacaan dibatasi, atau usage parsial. | Allowlist `include_usage` tetap tiga ID yang sudah diverifikasi. Probe opsional di batch tidak mengubahnya otomatis. |
| P1 | Fingerprint mencakup evaluator batch dan ledger baru. Routing off/shadow/adaptive, akses Frontier, baseline, penolakan kandidat dan syarat human review dipertahankan. | GPT-5.4 Mini kandidat retest, bukan default global baru. Screening gateway tidak diberi label ulang menjadi evaluasi aplikasi. |
| P2 | `npm run test:all` membuat rencana tanpa jaringan secara default. Screening, aplikasi dan diagnosis opsional dapat memakai satu ledger request/token/waktu/biaya untuk semua model, peran dan retry. Dispatch intent disimpan sebelum fetch; resume tidak mengulang sampel gagal/meragukan. | Kegagalan auth/billing/429 menghentikan batch bersama. Scope yang diblokir, termasuk Frontier tanpa akses, tetap gagal/diblokir. |
| P2 | Rubrik tambahan `screening-dimensions-v1` memisahkan isi yang dapat diukur, format, instruksi sempit, kelengkapan, teknis dan review. Report aplikasi per model menyimpan `kind=application-evaluation` yang sebenarnya dan fingerprint baru. | Status/checks/rubrik historis tidak ditulis ulang. Tidak ada skor gabungan baru untuk mengurutkan dimensi dengan cakupan berbeda. |

Cap produksi tidak dinaikkan. Benchmark lama meminta 512 untuk GPT/Claude/DeepSeek, dan builder memberi minimum 1024 untuk Gemini. Cap mungkin berkontribusi terhadap truncation, tetapi konsumsi reasoning atau perilaku gateway belum menjadi penyebab yang terbukti. Gunakan `--caps` untuk rancangan diagnostik terarah; jangan mengklaim perbaikan live dari tes mock.

## Bukti kalibrasi dan routing

Fingerprint pipeline awal: `9c89c4000ff157eea641afcaf3e122fd9bd4445cee8ae9a2e22ae4f16f7ff6af`. Fingerprint setelah patch terdapat di `analysis/analysis.json`; prompt produksi tetap mempunyai hash `fd913dd42fd9f8eaf07e4a9e244a2ce777ea9fe52dc987b8bec7d5ac38a62297` pada clock kanonis.

Laporan aplikasi 11:07:16Z (GPT-4o Mini) dan 11:09:42Z (GPT-5.4 Mini), masing-masing Daily/Fast 18 sampel/tiga pengulangan, cocok dengan pipeline awal. Hasil historisnya 50% dan 100% objektif. Keduanya sekarang tidak kompatibel dengan fingerprint baru dan tidak dapat mempromosikan kandidat untuk source ini. Semua laporan lama dibiarkan utuh; tidak ada hash yang disalin atau `authorKind=human` yang dibuat oleh AI.

Retest minimum yang relevan tersedia di [retest-plan.json](retest-plan.json). Setelah retest, operator tetap perlu review manusia, data usage yang cukup, pemeriksaan scope dan policy yang sah sebelum promosi. Laporan screening tidak dapat menggantikannya.

## Satu perintah PowerShell untuk rencana gabungan

Jalankan dari root proyek dengan Node.js 24.22.1:

```powershell
npm run test:all -- --plan --profiles screening,application --application-models gpt-4o-mini,gpt-5.4-mini --screening-repeat 1 --application-repeat 3 --fixture tests/fixtures/routing-retest-daily.json --modes fast --max-requests 168
```

Ini merencanakan 96 screening (12 model × delapan kasus × satu pengulangan), ditambah 36 sampel aplikasi (dua model × enam kasus × tiga pengulangan). Maksimal 168 dispatch mencakup hingga 72 percobaan aplikasi. Input/output seluruh peran dan retry aplikasi tetap memakai budget produksi; batch juga membatasi reservasi total token, token terlapor, waktu dan USD. Daftar model, kasus, persona, mode, pengulangan, cap screening dan ceiling dapat dipilih pada CLI. `--output-cap`/`--caps` tidak mengganti kebijakan output produksi aplikasi.

Live tidak dijalankan dalam pekerjaan ini. Bila nanti diotorisasi, perintah yang sama dengan `--live` menggantikan `--plan` tetap memerlukan `AET_LIVE_TEST_APPROVED=true`, guard cap provider yang baru diverifikasi pada key yang sama, serta tarif operator valid melalui konfigurasi yang sudah ada. Jangan mengubah tanggal, harga, key binding atau attestasi lama agar guard lolos. Sisa cap provider setelah penggunaan terdahulu harus benar-benar tersedia; membuat run baru tidak mereset tagihan key.

Estimasi dengan tarif historis (bukan penawaran harga saat ini) sekitar USD 1,19248108 untuk screening + plafon konservatif USD 1,15361280 untuk aplikasi = USD 2,34609388. Angka tersebut mendekati plafon lokal USD 2,40 dari cap USD 3. Parameter/prompt/harga baru dapat mengubahnya. Plan tanpa tarif valid menampilkan `null`; live berhenti bila reservasi berikutnya tidak dapat ditampung. Tiga pengulangan screening semua model akan memerlukan anggaran lebih besar pada tarif historis dan tidak dijanjikan selesai di bawah cap lama.

`--diagnose-usage` menambah kontrol A/B tanpa/dengan opsi usage bagi model yang dipilih, memakai ledger yang sama. Diagnosis tidak termasuk retest minimum di atas dan harus direncanakan di dalam plafon bersama. Tidak ada probe berbayar yang sudah dilakukan oleh patch ini.

Satu folder hasil memuat `report.json`, `summary.md`, `review.csv`, serta laporan aplikasi per model bila profil aplikasi dijalankan. CSV review memakai ID sampel buram dan tidak menampilkan label kandidat/mode pada kolom review. Pengguna dapat mengunggah satu ZIP folder hasil untuk analisis gabungan. Bila Windows memblokir penggantian checkpoint, gunakan file checkpoint terbaru yang dilaporkan CLI.

Untuk resume, gunakan opsi identik ditambah `--resume <report.json-terbaru>` dan folder output baru. Batas, fingerprint, dataset, tarif, key binding dan reservasi diverifikasi; dispatch meragukan tidak diputar ulang. Deadline asli tetap berlaku. Claim immutable mencegah pengulangan sumber resume yang sudah melanjutkan dispatch.

CLI lama `test:benchmark` dan `test:ai` tetap tersedia. Batch baru memanggil orkestrator server secara langsung; transport HTTP endpoint, vision, tools eksternal, konteks panjang dan scope yang belum dipilih tidak dianggap sudah dievaluasi.

## Verifikasi lokal

Hasil lengkap dan log ada di `validation/`. Node.js yang digunakan persis v24.22.1, pada Linux. Dependency dipasang sesuai lockfile; tidak ada upgrade dependency.

- `npm test`: 216 tes lulus, nol gagal. Termasuk regresi `length`/trailing usage, byte/time limit, abort, JSON mentah, koreksi format, keluarga model, usage null, budget lintas model/peran, resume dan policy routing.
- `npm run lint`: exit 0, nol error, satu warning lama `_init` pada `tests/chat-route.test.mts:17`.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0; Next.js 16.4.2 menghasilkan build produksi.
- `node scripts/check-source-syntax.mjs`: 142 file diperiksa, nol gagal; pemeriksaan ini melengkapi pemeriksaan tipe/build, bukan menggantikannya.
- Analisis offline: seluruh 96 request dan 87 hasil objektif lengkap dapat direproduksi; hash semua berkas historis sumber tetap sama.
- Simulasi batch 12 model menghasilkan 96 screening dan mencatat penolakan akses Frontier pada profil aplikasi. Model yang tidak berhak tidak diberi hasil PASS palsu. Simulasi terpisah memeriksa planner, dua worker, answer dan verifier dalam ledger bersama.

Belum diuji: provider live setelah patch, tagihan aktual, human review, native parameter baru, atau eksekusi PowerShell di Windows. Skrip PowerShell disediakan dengan pemeriksaan hash, backup sebelum perubahan dan rollback; PowerShell tidak tersedia di lingkungan pengujian ini.
