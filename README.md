# AET AI — Full-Stack Persona Evolution 2.1.1

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
- 12 model terkurasi lulus smoke test teks dan streaming Sumopod. Default tetap `gpt-4o-mini`; model tidak diganti diam-diam bila gagal.
- Percakapan baru, cari, pindah, ganti nama, hapus, edit, coba ulang, dan hentikan respons. Riwayat lama dimigrasikan secara lokal dan key lama tetap disimpan.
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

`npm run test:live` dan `npm run test:benchmark` memanggil layanan berbayar. Keduanya membutuhkan `SUMOPOD_API_KEY` dan `AET_LIVE_TEST_APPROVED=true`. Pasang batas pengeluaran di akun penyedia sebelum menjalankan. Variabel persetujuan dan jumlah token **tidak** menjamin biaya aktual; tagihan perlu dilihat di dashboard penyedia. Laporan tes tidak mencantumkan key.

## Dokumentasi

Mulai dari `docs/MASTER_PROMPT_COMPLETION_AUDIT.md` dan `docs/FINAL_IMPLEMENTATION_REPORT.md`, lalu audit fungsi/keamanan, katalog model, kompatibilitas Sumopod, spesifikasi persona, benchmark, arsitektur tools, preservasi database, laporan regresi, dan changelog 2.1. Laporan redesign lama dipertahankan sebagai catatan baseline dan diberi penanda; klaim integritas backend lama tidak berlaku sebagai klaim untuk versi 2.1.

Batas utama: beberapa dependency turunan masih terdaftar rentan; kualitas jawaban tidak selalu mengikuti jumlah kata/format sitasi secara tepat. Baca audit keamanan dan benchmark sebelum penggunaan publik.

## Hasil audit lanjutan 2.1.1

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
