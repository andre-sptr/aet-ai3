# Arsip README dari ZIP masukan

Dokumen historis ini bukan hasil validasi pekerjaan 24 Oktober 2026. Laporan lama yang disebutkan di bawah tidak ada dalam ZIP masukan; angka dan kemampuan live di bawah belum diverifikasi ulang. README aktif di root telah diperbarui.

# AET AI — Full-Stack Persona Evolution 2.1.1

> **Hasil optimasi terbaru — 22 Oktober 2026:** baca `docs/AI_OPTIMIZATION_REPORT_20261022.md`, `docs/AI_REGRESSION_FINAL_20261022.md`, dan `docs/AI_ROUTING_POLICY_20261022.md`. Dependency, 131 tes, lint, typecheck, build dan 84 pemeriksaan HTTP lulus. Metadata Sumopod HTTP 200 memuat seluruh 12 ID. Generasi live belum dijalankan karena bukti cap provider pada key dan tarif resmi belum terverifikasi. Routing default `off`, model default tetap `gpt-4o-mini`; pilihan manual dipertahankan. QA browser BLOCKED karena unduhan Chromium tidak valid. Catatan audit sebelumnya di bawah tetap disimpan sebagai riwayat.


> **Catatan audit sebelumnya — 22 Oktober 2026:** bug penghapusan riwayat, autosave, pembatalan, validasi stream, URL Markdown dan integritas hasil tools sudah dipatch. `docs/AI_FULL_AUDIT.md` dan `docs/AI_REGRESSION_TEST_REPORT.md` adalah rujukan audit sebelumnya. Laporan lama di bawah merupakan arsip, bukan hasil pengujian patch ini. Benchmark gateway baru BLOCKED (HTTP 403 lingkungan); build/lint/PDF/DOCX/visual belum terverifikasi ulang karena dependency tidak dapat diunduh.

AET AI untuk Himpunan Mahasiswa AET, Association of Electronics and Telecommunication, Politeknik Caltex Riau. Versi ini mempertahankan AET Signature Hybrid (tema terang), menambah tiga persona modular, multi-chat lokal, ekstraksi dokumen, dan pengamanan API.

## Menjalankan

Gunakan **Node.js 24** dan npm. Dari folder `aetpcr`:

```bash
cp .env.example .env
npm ci
npx prisma generate
npm run dev
```

PowerShell: gunakan `Copy-Item .env.example .env`. Buka `http://localhost:3000`; admin di `/login`. Isi konfigurasi sebelum mencoba layanan. Database bawaan `prisma/dev.db` disertakan dan identik dengan baseline. **Pertahankan database server milik Anda saat memperbarui source.** Tidak diperlukan migrasi schema atau reset database.

## Konfigurasi

| Variabel | Ketentuan |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db` untuk database bawaan; path relatif terhadap schema Prisma. |
| `SUMOPOD_API_KEY` | Secret server untuk respons AI. Isi sendiri; tidak disertakan. |
| `SUMOPOD_BASE_URL` | Default `https://ai.sumopod.com/v1`; HTTPS wajib di luar gateway tes loopback. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Akun admin pengelola; password minimal 12 karakter. Tidak ada kredensial bawaan. |
| `ADMIN_SESSION_SECRET` | Wajib untuk login admin, string acak minimal 32 karakter. |
| `AET_FRONTIER_ACCESS_SECRET` | Secret acak terpisah minimal 32 karakter untuk token Frontier. |
| `APP_ORIGIN` | Origin publik persis, misalnya `https://domain-anda.example`; wajib untuk request mutasi produksi. Sesuaikan contoh localhost saat deploy. |
| `ENABLE_FRONTIER` | Default `false`. Aktifkan setelah menetapkan kebijakan biaya di akun penyedia. |
| `TRUST_PROXY` | Default `false`; hanya `true` jika reverse proxy tepercaya menimpa `X-Forwarded-For`. |
| `CHAT_HOURLY_LIMIT` | Batas request global per proses, default 100/jam; bukan pengukur tagihan. |
| `TAVILY_API_KEY` | Opsional, untuk pencarian web. |
| `BLOB_READ_WRITE_TOKEN` | Opsional, untuk upload gambar admin ke Vercel Blob. |

Buat dua secret berbeda dengan generator kriptografis pengelola. Jangan memakai `NEXT_PUBLIC_*` untuk secret. Untuk menjalankan production build lokal, set `APP_ORIGIN=http://localhost:3000`.

Jika login admin ditolak, periksa respons `POST /api/auth/login` di Network browser. Halaman login menampilkan pesan dari field `error` API. Status `401` berarti kredensial tidak cocok, `403` berarti origin tidak cocok, `429` berarti batas percobaan tercapai, dan `503` berarti konfigurasi belum lengkap. `ADMIN_PASSWORD` harus minimal 12 karakter dan `ADMIN_SESSION_SECRET` minimal 32 karakter. Buat secret sendiri dengan `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

Simpan `.env.local` di folder yang sama dengan `package.json`, lalu restart proses aplikasi setelah mengubahnya. `APP_ORIGIN` harus sama persis dengan protokol, hostname, dan port alamat di browser; `localhost` berbeda dengan `127.0.0.1` dan IP jaringan. Environment proses atau aaPanel dapat menimpa nilai file; `.env.production.local`/`.env.development.local` juga memiliki prioritas lebih tinggi daripada `.env.local`. Jika password mengandung `$`, tulis sebagai `\$` di file environment Next.js. Login pada production memerlukan HTTPS karena cookie sesi memakai `Secure`.

## Kemampuan

- `daily`: Smart Companion; `report`: Academic Writer; `coding`: Coding Expert.
- 12 model terkurasi dipertahankan. Smoke test lama tersedia sebagai arsip; audit ulang gateway terbaru BLOCKED. Default tetap `gpt-4o-mini`; tidak ada silent fallback.
- Percakapan baru, cari, pindah, ganti nama, hapus, edit, coba ulang, dan hentikan respons. Riwayat lama dimigrasikan secara lokal. Saat penghapusan, salinan key lama dibersihkan setelah migrasi v2 dipastikan tersimpan.
- PDF bertulisan, DOCX, TXT: maksimal 5 MB; PDF maksimal 100 halaman; teks konteks maksimal 24.000 karakter. PDF scan memerlukan OCR di luar aplikasi.
- Analisis gambar aktif pada GPT-4o Mini setelah uji dasar gateway dan route aplikasi. Model lain tetap diblokir untuk gambar; GPT-4.1 Mini gagal uji warna. Maksimal empat gambar terbaru per request. Ini bukan jaminan akurasi gambar kompleks.
- CMS berita, kegiatan, dan tim dilindungi autentikasi, validasi, serta pemeriksaan konflik update. Tanggal kegiatan diproses eksplisit dalam WIB.
- Pencarian web, cuaca, kurs, scraper HTTPS aman, konversi satuan, statistik sederhana, warna, validasi format email, dan password kriptografis. Keberhasilan layanan eksternal bergantung konfigurasi/ketersediaannya.

Riwayat disimpan di browser/perangkat yang sama, belum sinkron antarpengguna. Data biner attachment dikeluarkan dari penyimpanan; teks hasil ekstraksi tetap ada. Gunakan perangkat tepercaya dan hapus percakapan dari UI jika tidak ingin menyimpannya.

## Pemeriksaan

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
npm run test:http
python3 scripts/evaluate-benchmark.py
python3 scripts/check-benchmark-code.py
```

`test:http` dijalankan **sesudah build**, membuat salinan SQLite sementara, gateway simulasi lokal, dan server production test; tidak memanggil Sumopod. Jangan menjalankan build bersamaan dengan preview/test server yang menggunakan direktori `.next` yang sama.

Jika instalasi mengalami error ekstraksi ENOENT pada lingkungan dengan I/O terbatas, ulangi dengan `npm ci --maxsockets=2`. Setelah pembaruan framework, gunakan workspace bersih atau pindahkan cache `.next` lama sebelum membangun. Script pemeriksaan kode benchmark hanya menjalankan snapshot yang telah ditinjau; periksa ulang jika snapshot diubah.

Untuk menjalankan aplikasi produksi:

```bash
npm run build
npm start
```

Pasang devDependencies sebelum build. Prisma Client berada di `dependencies`. Setelah build, lingkungan produksi tetap membutuhkan Prisma Client dan parser dokumen. Multi-replica membutuhkan limiter bersama di gateway; limiter saat ini hanya per proses.

## Pengujian API berbayar

Hasil yang sudah direkam ada di `docs/model-verification.json`, `docs/benchmark-live-results.json`, dan `docs/benchmark-refinement-results.json`. Tidak perlu mengulangnya untuk menyalakan aplikasi.

`npm run test:benchmark` sekarang memakai katalog aktual dan 96 sel (12 model × delapan kasus), persona produksi, serta validator yang dapat diaudit. Harness berbayar memerlukan `SUMOPOD_API_KEY`, `AET_LIVE_TEST_APPROVED=true`, dan `AET_BENCHMARK_BUDGET_FILE` yang mencatat cap provider dan SHA-256 key khusus, serta `AET_BENCHMARK_PRICING_FILE` yang mencatat tarif resmi input/output setiap model. Cap provider harus diperiksa operator dalam 24 jam terakhir. Batas absolut tugas USD 3; angka environment saja tidak cukup. Salin `docs/benchmark-budget.example.json` hanya setelah cap benar-benar diverifikasi; contoh default tidak mengizinkan generasi. Attestasi operator bukan pemeriksaan billing otomatis. Laporan tidak mencantumkan key dan memakai path unik per run. Jalankan `npm run test:benchmark:plan` untuk rencana tanpa jaringan/biaya. Skrip `benchmark-personas.mjs` lama tetap merupakan benchmark satu model, bukan pengganti harness 12 model.

## Dokumentasi

Mulai dari `docs/AI_OPTIMIZATION_REPORT_20261022.md` untuk pekerjaan terbaru. Untuk arsip, lihat `docs/MASTER_PROMPT_COMPLETION_AUDIT.md` dan `docs/FINAL_IMPLEMENTATION_REPORT.md`, lalu audit fungsi/keamanan, katalog model, kompatibilitas Sumopod, spesifikasi persona, benchmark, arsitektur tools, preservasi database, laporan regresi, dan changelog 2.1. Laporan redesign lama dipertahankan sebagai catatan baseline dan diberi penanda; klaim integritas backend lama tidak berlaku sebagai klaim untuk versi 2.1.

Batas utama: beberapa dependency turunan masih terdaftar rentan; kualitas jawaban tidak selalu mengikuti jumlah kata/format sitasi secara tepat. Baca audit keamanan dan benchmark sebelum penggunaan publik.

## Arsip hasil sebelum audit penghapusan riwayat

77/77 unit, 84/84 HTTP, 9/9 integrasi aplikasi dengan Sumopod asli, lint, TypeScript dan production build lulus. Dua belas kandidat model lulus teks/stream; Gemini kini memiliki headroom minimum 1024. Konteks dihitung setelah ekstraksi, sumber tools tampil pada pesan, unggahan usang dibatalkan, dan contoh sitasi berplaceholder/pembuatan DOI memiliki respons terkontrol.

Benchmark final berisi 60 pasangan baseline/optimized dengan hasil positif dan negatif, serta dua respons kebijakan sitasi. Jangan menafsirkan 12/13 batas objektif sebagai jaminan seluruh jawaban benar. Jumlah kata persis dan sitasi di luar aturan terkontrol masih dapat salah.

Pemeriksaan browser final terhalang kebijakan URL; responsivitas/interaksi final belum diverifikasi lengkap. Cuaca/kurs/scraper terhalang lingkungan pengujian, Tavily dan Blob memerlukan token operator sendiri. Limiter tetap per-process. Detail status setiap bagian master prompt ada di docs/MASTER_PROMPT_COMPLETION_AUDIT.md.

Pengujian tambahan opsional:

```bash
npm run test:tools
npm run test:vision
npm run test:live-app
```

Dua perintah terakhir memakai API berbayar dan membutuhkan SUMOPOD_API_KEY serta AET_LIVE_TEST_APPROVED=true. AET_TEST_BUDGET_USD mencatat batas yang telah Anda tetapkan pada penyedia; variabel itu bukan pengukur tagihan atau spending cap otomatis. Gunakan key server melalui environment. Jangan menyimpan key di source, log atau ZIP.

## Pemeriksaan patch terbaru

```bash
npm run test:history
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:http
node scripts/check-source-syntax.mjs
```

Tes `chat-route.test.mts` menjalankan handler produksi dengan gateway simulasi, tanpa Next.js server/database produksi. Tes harness juga memakai provider lokal simulasi; token pada fixture tersebut bukan penggunaan Sumopod. Kegagalan import parser tidak lagi dianggap lulus tes penolakan PDF. Riwayat v2 kosong merupakan penanda penghapusan yang sah; sesi sapaan baru tidak menjadi entri riwayat sebelum ada pesan pengguna.

Setelah jaringan dependency/gateway tersedia, ulangi quality gates, QA browser desktop/mobile, PDF/DOCX, dan benchmark dengan cap key yang dibuktikan. Jangan melakukan deployment berdasarkan hasil simulasi saja. Pengujian pada audit ini tidak melakukan deployment, push, perubahan kredensial atau operasi tulis ke database asli.
