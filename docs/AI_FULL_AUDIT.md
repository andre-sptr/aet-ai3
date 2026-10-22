# AET AI — audit penuh, perbaikan dan hasil pengujian

Tanggal: 22 Oktober 2026 WIB. Source aktual: `aetpcr.zip`, root `aetpcr/`. **Status keseluruhan: BLOCKED**, karena benchmark gateway dan beberapa quality gates tidak dapat dijalankan sampai selesai. Perubahan source benar-benar diterapkan; hasil simulasi tidak dinyatakan sebagai keberhasilan model nyata atau production build.

## 1. Hasil utama

Bug tombol sampah header dipatch menjadi penghapusan satu percakapan berdasarkan ID, termasuk penghapusan per-item pada rail dan dialog riwayat. State/ref/store aktif diselaraskan setelah penyimpanan berhasil, sesi kosong tidak muncul sebagai riwayat, dan autosave lama ditolak. Proteksi pembatalan, validasi stream, URL Markdown, integritas tools dan budget benchmark ikut diperbaiki berdasarkan kode yang diperiksa.

`npm test` final melaporkan **114 hasil: 107 PASS, 7 FAIL**, seluruh tujuh kegagalan terkait dependency yang tidak tersedia. Subset tanpa dependency eksternal **79/79 PASS**; suite riwayat/streaming/CMS helpers **30/30 PASS**. Sepuluh tes handler backend produksi memakai gateway simulasi dan lulus. Sintaks 103 file dan semantic typecheck subset core lulus. Full typecheck, lint, Prisma generate, build, full HTTP/CMS, browser, PDF/DOCX dan Sumopod nyata belum lulus audit ulang.

## 2. Kondisi awal dan klaim arsip

Dokumen persona/model/tools, audit keamanan, laporan implementasi, laporan regresi, benchmark dan metadata di docs diperiksa terhadap source. Pada baseline sesi ini npm test hanya dapat melaporkan 45 hasil (41 PASS, empat file gagal import), karena dependency tidak ada. Angka 77 unit, 84 HTTP, sembilan live app dan 12 model pada laporan lama tetap merupakan **rekaman unggahan**, bukan hasil eksekusi sesi ini.

`benchmark-personas.mjs` lama mematok gpt-4o-mini. `benchmark-audit-final.json` memang berisi 120 output model itu dan dua output kebijakan sitasi; tidak membuktikan kualitas seluruh model. Kemampuan image hanya dipertahankan untuk GPT-4o Mini dari bukti historis. Harga, native tools, reasoning parameters dan kapasitas konteks penuh tidak dianggap terverifikasi.

## 3. Temuan, penyebab dan patch

| ID | Severity | Temuan dan root cause | Patch | Validasi |
| --- | --- | --- | --- | --- |
| H01 | HIGH | Header menghapus pesan saja: confirmClearChat hanya mengganti messages; objek ConversationStore tetap ada. | Delete berdasarkan ID terpilih, satu dialog, header dan per-item memakai jalur yang sama. | PASS logika; BLOCKED UI |
| H02 | HIGH | Autosave snapshot usang: Cleanup effect memanggil save() dengan snapshot yang dapat mendahului penghapusan/switch/rename. | saveCurrentSnapshot memeriksa identitas snapshot/ref dan mode sebelum menulis; deletion dipersistenkan sebelum publish. | PASS |
| H03 | MEDIUM | Riwayat kosong dan legacy dapat membingungkan pemulihan: Loader menolak conversations=[] dan pembuatan sesi sapaan menghasilkan entri riwayat; key lama masih menyimpan salinan data. | Store v2 kosong sah; sesi kosong hanya di memori; legacy dihapus setelah migrasi durable sebelum deletion commit. | PASS |
| H04 | HIGH | Respons terlambat dan pembatalan: Ownership yang tersebar di beberapa refs dan decoder FileReader/Image tidak langsung mengikuti abort. | RequestLifecycle untuk chat/lampiran, guard queued updater; decoder file/gambar mengikuti signal dan timeout. | PASS lifecycle/route; INCONCLUSIVE browser decoder |
| H05 | HIGH | DONE dianggap jawaban selesai tanpa stop: Parser menganggap [DONE] cukup; finish lain yang tidak didukung dapat terlewat; ID provider tidak diperiksa. | Wajib finish_reason=stop dan teks nonkosong; tolak length/filter/tool/unknown, primitif dan ID eksplisit berbeda; metadata identitas/origin dibedakan. | PASS mock/unit; BLOCKED live |
| H06 | HIGH | URL Markdown melewati filter: MessageBubble memakai urlTransform identity sehingga kebijakan URL bawaan renderer dilewati. | Policy URL menolak skema aktif/HTML/SVG/credentials/control chars, mempertahankan web/raster/video aman; KaTeX trust=false eksplisit. | PASS policy unit; BLOCKED renderer browser |
| H07 | HIGH | Budget harness hanya angka deklaratif: Skrip lama mencatat AET_TEST_BUDGET_USD tanpa bukti enforcement USD. | Semua harness berbayar memakai guard fail-closed, cap provider key khusus <=USD3 dengan attestasi operator terbaru; serial/retry0/cap request dan token. | PASS negative/local tests; BLOCKED provider evidence |
| H08 | MEDIUM | Konflik format persona: Coding mewajibkan fenced code untuk setiap kode, berlawanan dengan permintaan kode mentah; core menyebut seluruh riwayat pengguna sekadar data. | Instruksi langsung pengguna menentukan tugas/format; kutipan/lampiran/tools tetap tidak tepercaya; raw code didukung eksplisit. | PASS composition/request; INCONCLUSIVE model behavior |
| H09 | MEDIUM | Negasi tool dan status sukses palsu: Negasi multi-kata bisa lolos router unit; respons search/weather/currency malformed bisa memiliki status ok. | Negasi konservatif diperluas, bentuk data sumber diperiksa, body HTTP gagal dicancel. | PASS mocked/deterministic; BLOCKED external |
| H10 | MEDIUM | Tes penolakan PDF dapat false-positive: Assertion ApiError saja menerima error generik akibat parser yang tidak terpasang. | Pastikan parser dapat diimport, periksa status halaman/scan yang sesuai, dan pisahkan TXT dari DOCX. | PASS integrity of failure reporting; BLOCKED parser tests |
| H11 | LOW | Parser DOCX dimuat pada semua jalur: Import Mammoth top-level ikut terangkut walau request tidak membutuhkan DOCX/knowledge. | Lazy import hanya pada ekstraksi DOCX atau cache miss knowledge. | PASS TXT/no-document route; BLOCKED DOCX |
| H12 | MEDIUM | Cakupan benchmark terbaru belum tersedia: Skrip benchmark-personas lama hanya satu model; hasil smoke lama tidak menguji seluruh persona/reasoning. | Harness katalog aktual 96 sel, fixture acuan, request/usage/status/raw visible output/skor per dimensi; laporan lama dipertahankan. | PASS harness mock; BLOCKED all live model cases |

File terkait per temuan dan hasil terstruktur ada pada `AI_AUDIT_FINDINGS.json`. Tidak ada perubahan dependency/lockfile besar, autentikasi, signing secret, schema, konten CMS atau identitas visual AET. Penyesuaian visual hanya kontrol hapus per-item dan penjelasan dialog yang diperlukan untuk perilaku baru.

## 4. Penghapusan riwayat: perilaku dan bukti

- Header dan tombol setiap item membawa **ID target**, bukan menghapus seluruh mode. Tombol hapus item adalah sibling tombol aktif, bukan button bersarang; label aksesibilitas menyebut judul. Dialog native yang sudah ada tetap menyediakan Escape/focus containment.
- Penghapusan aktif membatalkan chat dan lampiran serta menginvalidasi ticket ownership. Request yang sudah selesai tetap dapat menerapkan final updater yang terantre sampai view berikutnya, tetapi ticket lama tidak dapat mengubah percakapan baru.
- `deleteStoredConversation` menulis store baru sebelum caller mempublikasikan React state/ref. Jika write gagal, daftar tidak menyatakan penghapusan berhasil; UI menampilkan error. Jika ada key legacy, migrasi penuh dipastikan durable sebelum salinan legacy dibersihkan.
- Sisa percakapan dipertahankan. Saat aktif terhapus, fallback memilih percakapan berisi pesan pengguna sebelum draft lama. Penghapusan nonaktif mempertahankan activeId.
- Penghapusan terakhir menyimpan `{version:2,activeId:'',conversations:[]}` dan menghasilkan sesi baru di memori. Loader menerima tombstone kosong dan tidak mengimpor ulang data lama. Sapaan/new draft tidak masuk riwayat sebelum ada pesan pengguna.
- Autosave memeriksa bahwa snapshot masih identik dengan storeRef saat timer, pagehide dan cleanup dipanggil. Snapshot superseded atau mode berbeda tidak ditulis ulang. Kegagalan baca pada satu mode tidak menonaktifkan penyimpanan mode sehat berikutnya.

| Syarat regresi | Bukti logika yang dijalankan | Batas |
| --- | --- | --- |
| ID aktif hilang, key tidak memuat data, item lain utuh, fallback benar | conversation-deletion.test.mts | Storage double, bukan browser nyata |
| Hapus item nonaktif dan draft fallback | conversation-deletion.test.mts | Klik/focus UI belum diverifikasi |
| Hapus terakhir dan reload berulang tidak memulihkan | Loader/persistence produksi dipanggil ulang terhadap JSON tersimpan | Bukan reload halaman browser |
| Respons AI/lampiran terlambat dibuang | Pekerjaan tertunda + RequestLifecycle; abort handler route | FileReader/canvas fisik belum diverifikasi |
| Autosave dan cleanup usang ditolak | Timer terjadwal + saveCurrentSnapshot | Mount/unmount React belum diuji browser |
| Search/rename/new/edit/retry/mode tetap konsisten | Helper/store tests dan request context | Alur klik UI masih BLOCKED |
| Gagal storage tidak diklaim sukses | Writer exception, original durable data, failed legacy removal | Tampilan error browser belum diamati |

Riwayat disimpan lokal pada browser ini. Penghapusan tidak mengklaim cloud sync, salinan perangkat lain, atau penyimpanan server yang tidak dipakai aplikasi. Penulisan bersamaan dari tab/browser lama lain belum memiliki distributed locking; tes concurrency saat ini mencakup lifecycle dan autosave dalam satu instance aplikasi.

## 5. Evaluasi 12 model dan persona

| ID model | Daily | Report | Coding | Reasoning 3 jenis | Konteks/stream baru |
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

Rencana minimum terpenuhi pada dataset/harness: 36 persona + 36 penalaran + 12 retensi koreksi + 12 smoke streaming = 96 sel. **Tidak ada sel model nyata yang dijalankan.** Satu preflight harness menerima HTTP 403 dengan teks `Forbidden. Calls to this URL are not allowed.` Dua probe koneksi awal juga ditolak. Ini pembatasan URL lingkungan; key tidak dikirim pada probe, sehingga tidak membuktikan key salah/valid atau model tidak tersedia.

Raw hasil terstruktur tersedia pada `AI_MODEL_BENCHMARK.json` dan direktori `benchmarks/run-2026-10-22T03-28-12-368Z-ebdf5ad5/`. Setiap kasus menyimpan payload request tanpa header secret, reference/failure conditions, attempted=false, status BLOCKED, latency/output/usage model null, dan tujuh skor dimensi null. Tidak ada skor gabungan atau skor model yang dikarang.

## 6. Penalaran, rubrik dan rekomendasi

Dataset memiliki jawaban acuan: total belanja `12 × 15000 × 0,8 + 10000 = 154000`; jadwal unik `A=Senin; B=Rabu; C=Selasa` dibuktikan dengan enumerasi; data kelas 25 versus 30 tanpa penentu harus mengakui bahwa persentase tunggal belum pasti; koreksi anggaran terbaru harus menghasilkan `900000`.

Persona Coding memeriksa bug off-by-one. Hanya dua grammar program yang sangat sempit diterima sebelum eksekusi tujuh array edge cases; kode model arbitrer tidak dievaluasi. Daily menguji dua poin/20–45 kata dan saran praktis; Report menguji satu paragraf/60–90 kata, korelasi/kausalitas/perancu dan tidak mengarang sumber. Keyword tidak dipakai untuk memberi skor kualitas argumentasi atau kejujuran secara palsu.

Dimensi 0–5: accuracy, instruction following, persona consistency, completeness/relevance, epistemic integrity, efficiency, streaming/integration. Validator objektif memberi 0/5 hanya untuk kriteria yang dapat dibuktikan; dimensi kualitatif tetap null sampai review tercatat. Respons Daily/Report yang memenuhi batas objektif tetap INCONCLUSIVE tanpa review persona. Tidak ada hidden chain-of-thought yang diminta/disimpan, atau model judge tambahan.

**Belum ada model terbaik yang dapat direkomendasikan untuk Daily, Report atau Coding.** Default gpt-4o-mini dipertahankan sesuai konfigurasi awal. Keberhasilan solver/validator dan gateway lokal tidak membuktikan kemampuan reasoning model sebenarnya. Satu sampel per persona pun hanya screening, bukan ranking kualitas dengan keyakinan tinggi.

## 7. Keamanan, streaming, konteks, tools dan lampiran

Parser menuntut stop, teks terlihat nonkosong, menolak model eksplisit berbeda dan finish reason yang tidak didukung. Error/partial tidak masuk historyForModel sebagai fakta. Klien dan server membatalkan reader yang sedang menunggu. Harness dapat membaca usage frame setelah stop tanpa menyimpan reasoning_content; produksi tetap selesai segera pada stop. SSE membedakan requestedModel, reportedModel, asal application/gateway dan status identity. Hasil password/kebijakan deterministik tidak diklaim sebagai output model.

Context selection menjaga suffix terbaru dan koreksi dalam batas 40 pesan/48k karakter, kemudian dihitung ulang setelah ekstraksi. Pengurangan konteks tetap diberitahukan lewat metadata. Dokumen/web/tools dibingkai sebagai data tidak tepercaya. Source provenance hanya berasal dari alat server, bukan link yang dikarang model. Filter sitasi deterministik tetap sempit pada contoh APA berplaceholder/permintaan membuat DOI; bukan validator seluruh bibliografi.

PDF/DOCX/TXT, batas 5 MB/100 halaman/24k karakter dan maksimum empat gambar terbaru dipertahankan. TXT dan pembatasan konteks benar-benar diuji. PDF/DOCX saat ini BLOCKED karena parser tidak terpasang. Vision tidak diaktifkan untuk model lain. Decoder gambar/file kini mengikuti abort; pengujian DOM/kamera masih memerlukan browser.

Origin validation, rate/concurrency caps, HMAC/expiry, signing secret, Frontier default off/token/limiter dan HTTPS/DNS/TLS-pinning/SSRF bounds dipertahankan. Tes auth/origin/SSRF lokal lulus; ini bukan pentest lengkap. Advisory dependency pada arsip tidak dianggap hasil npm audit terbaru; registry sekarang terblokir. Tidak ada upgrade dependency massal.

## 8. Request, penggunaan dan biaya

- Generasi Sumopod: **0 request**, token generasi yang dilaporkan **0**. Usage per kasus null karena tidak dijalankan.
- Preflight dalam harness: **1** metadata request; dua probe HEAD/GET awal dicatat terpisah. Semua ditolak 403.
- Biaya USD aktual: **unknown**, karena billing tidak diakses. Tidak ada estimasi tarif yang dibuat.
- Anggaran absolut USD 3 tetap dijaga dengan tidak mengirim generasi ketika enforcement provider/tarif tidak dapat dibuktikan. AET_TEST_BUDGET_USD sendiri bukan cap.
- Semua harness berbayar menolak berjalan tanpa policy cap provider pada key khusus, attestasi operator terbaru, dan consent flag. Attestasi ini dicatat sebagai pemeriksaan operator, bukan API billing otomatis. Serial, retry0, max96 request dan cap output eksplisit tetap diberlakukan.
- Key sementara tidak ditulis ke source, env file, log, fixture, laporan atau ZIP; tidak dikirim pada probe yang terblokir. Tidak dilakukan rotasi/pencabutan key.

Dokumentasi primer yang diperiksa: [base URL/API kompatibel OpenAI](https://docs.sumopod.com/guides/ai/openai-compatible-api) dan [key dengan credit limit opsional](https://docs.sumopod.com/guides/ai/create-api-key). Dokumentasi itu tidak cukup untuk mengaktifkan parameter reasoning/native tools, memastikan tarif seluruh model, atau mengganti uji vision.

## 9. Quality gates dan preservasi

Lihat `AI_REGRESSION_TEST_REPORT.md` serta JSON/log perintah. Lint exit127, build exit127, full TypeScript exit2, Prisma generate exit1 dan HTTP harness exit1 adalah hambatan nyata. UI desktop/mobile belum dapat dinilai dari aplikasi final yang berjalan. Screenshot lama tetap arsip.

| File yang dijaga | SHA-256 |
| --- | --- |
| prisma/dev.db | dc579014c71daa611b500c291e6e3878678da4d9ba8d2f9a4a87dd9ad0b2f45e |
| prisma/schema.prisma | e967a45b5ec1ed380efb9c6f354846f597e2067b124940280459bea28caa3b70 |
| package-lock.json | 8d7eca3ecf34d8539cfd89aaf409f51fc480ddd520e25a01eb3c5d8a7c6cff79 |

Database dibuka read-only untuk jumlah tabel/preservasi, tidak dimutasi. Modul auth dan Frontier tidak berubah. Semua laporan JSON/log lama tetap utuh; katalog lama juga disalin sebagai arsip. Daftar perubahan/hashes tersedia pada `AI_SOURCE_INTEGRITY.json`.

## 10. File utama dan kelanjutan yang diperlukan

Perubahan utama: ChatInterface, MessageBubble, conversations, request-lifecycle, sumopod, chat-stream, chat route, safe-message-url, tools/safe-web, lazy parser loading, tiga kebijakan persona, katalog, harness/fixture/tests dan dokumen audit. Source tersimpan lengkap dalam root aetpcr pada ZIP; env nyata, git metadata, node_modules, .next dan cache tidak dikemas. .env.example tetap aman.

Pekerjaan yang masih memerlukan lingkungan lain: instalasi dependency dari lockfile, Prisma generate, seluruh quality gates, browser desktop/mobile, parser PDF/DOCX, uji gateway live semua model dan review kualitatif. Alias/snapshot ID provider perlu diverifikasi jika berbeda dari requested ID; tidak diasumsikan setara. Penilaian biaya membutuhkan cap provider yang benar dan akses billing/tarif yang dapat dibuktikan. Jangan menganggap paket ini sudah lulus seluruh kriteria deployment produksi.
