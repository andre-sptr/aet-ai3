# AETAI — Adaptive AI Workspace

AETAI adalah aplikasi AI untuk Association of Electronics and Telecommunication (AET), Politeknik Caltex Riau. Aplikasi menyediakan percakapan dengan tiga persona, orkestrasi AI adaptif, pengolahan lampiran, tools, riwayat lokal, serta CMS berita, kegiatan, dan tim.

**Versi saat ini: 2.2.0**

Pengguna memilih **Fast**, **Normal**, atau **Think**. Server menentukan model dan strategi pengerjaan berdasarkan konteks, kebutuhan tugas, akses, bukti evaluasi, serta anggaran pemrosesan.

> Routing awal tetap memakai `gpt-4o-mini`. Kandidat lain tersedia dalam katalog, tetapi promosi model memerlukan bukti evaluasi yang memenuhi policy server. Pengujian simulasi tidak membuktikan peningkatan kualitas model live.

## Fitur

- Tiga persona: percakapan umum, penulisan akademik, dan pemrograman.
- Tiga mode pemrosesan yang dapat digunakan pada setiap persona.
- Penyusunan konteks dengan tujuan, batasan, koreksi, keputusan, dan rujukan pesan.
- Pemilihan model oleh server tanpa model picker di chat publik.
- Tools deterministik, pencarian web, pembacaan halaman, dan pengetahuan resmi AET.
- Review jawaban bersyarat dan maksimal satu revisi terarah.
- Pembatasan percobaan LLM, tools, token, waktu, biaya estimasi, dan konkurensi.
- Status proses melalui SSE serta pembatalan request.
- Percakapan lokal: buat, cari, pindah, ganti nama, edit, retry, dan hapus.
- Pengolahan PDF, DOCX, TXT, serta input gambar pada kandidat yang memenuhi syarat.
- Rendering Markdown, kode, matematika, dan diagram Mermaid.
- CMS berita, kegiatan, dan tim dengan autentikasi admin.
- Skrip evaluasi baseline, Fast, Normal, Think, serta benchmark kandidat model.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Framework | Next.js 16 |
| Antarmuka | React 19, TypeScript, Tailwind CSS 4 |
| Database situs | Prisma 5 dan SQLite |
| Gateway AI | Sumopod dengan format chat completion |
| Dokumen | Mammoth dan pdf-parse |
| Rendering jawaban | React Markdown, KaTeX, Mermaid, syntax highlighting |
| Upload gambar admin | Vercel Blob |
| Pengujian | Node.js test runner dan gateway simulasi |

Versi dependency yang digunakan tercantum dalam `package.json` dan `package-lock.json`.

## Persyaratan

- **Node.js 24**
- npm
- Key Sumopod untuk generasi AI live
- Konfigurasi admin untuk mengelola CMS
- Akses jaringan ke dependency dan layanan eksternal yang digunakan

Jalankan perintah dari root repo, yaitu direktori yang berisi `package.json`.

## Instalasi

### 1. Siapkan environment

Linux/macOS:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Isi konfigurasi sesuai kebutuhan. File `.env` disimpan bersama `package.json`.

### 2. Pasang dependency

```bash
npm ci
npx prisma generate
```

`npm ci` juga menjalankan `prisma generate` melalui `postinstall`.

### 3. Jalankan aplikasi

```bash
npm run dev
```

Alamat lokal:

- Aplikasi: `http://localhost:3000`
- Login admin: `http://localhost:3000/login`

## Konfigurasi Environment

### Aplikasi, database, dan autentikasi

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Default `file:./dev.db`; path relatif terhadap schema Prisma. |
| `APP_ORIGIN` | Origin aplikasi persis, termasuk protokol dan port. Wajib untuk mutasi pada production. |
| `ADMIN_USERNAME` | Username admin yang ditetapkan pengelola. |
| `ADMIN_PASSWORD` | Password admin, minimal 12 karakter. |
| `ADMIN_SESSION_SECRET` | Secret sesi admin, minimal 32 karakter. |
| `AET_FRONTIER_ACCESS_SECRET` | Secret terpisah untuk token akses AET, minimal 32 karakter. |
| `ENABLE_FRONTIER` | Default `false`; mengaktifkan kelayakan penggunaan kandidat Frontier. |
| `TRUST_PROXY` | Default `false`; aktifkan hanya jika proxy tepercaya menimpa `X-Forwarded-For`. |

Buat secret dengan generator kriptografis:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Gunakan nilai berbeda untuk secret admin dan akses AET. Jangan menyimpan secret dalam variabel `NEXT_PUBLIC_*`, source, log, atau commit.

`APP_ORIGIN` harus sesuai alamat browser. `localhost`, `127.0.0.1`, alamat IP, dan domain merupakan origin yang berbeda.

### AI dan layanan tambahan

| Variabel | Keterangan |
| --- | --- |
| `SUMOPOD_API_KEY` | Key server untuk generasi AI. |
| `SUMOPOD_BASE_URL` | Default `https://ai.sumopod.com/v1`. |
| `TAVILY_API_KEY` | Opsional, untuk pencarian web. |
| `BLOB_READ_WRITE_TOKEN` | Opsional, untuk upload gambar admin ke Vercel Blob. |

Layanan yang tidak dikonfigurasi dicatat sebagai tidak tersedia. Kegagalan tool tidak diperlakukan sebagai bukti yang berhasil diperoleh.

### Routing dan pembatasan pemrosesan

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `AET_ROUTING_MODE` | `off` | Mengatur promosi model: `off`, `shadow`, atau `adaptive`. |
| `AET_ROUTING_POLICY_FILE` | Kosong | Path policy routing operator dengan bukti evaluasi yang sesuai. |
| `CHAT_HOURLY_LIMIT` | `100` | Batas request chat global per proses per jam. |
| `AET_PROVIDER_MAX_CONCURRENT` | `4` | Konkurensi panggilan provider global per proses; batas konfigurasi 1–16. |
| `AET_PROVIDER_CALLS_PER_MINUTE` | `120` | Batas panggilan provider seluruh peran dan retry per proses. |
| `AET_CHAT_DEADLINE_MS` | Kosong | Override untuk menurunkan deadline mode. |
| `AET_MAX_REQUEST_USD` | Kosong | Opsional, batas reservasi estimasi biaya per request. |
| `AET_RUNTIME_PRICING_FILE` | Kosong | Tarif gateway terverifikasi untuk penghitungan estimasi biaya runtime. |

`AET_ROUTING_MODE=off` mempertahankan model baseline. Orkestrasi Fast, Normal, dan Think tetap berjalan.

Batas USD membutuhkan tarif yang valid. Reservasi biaya aplikasi tidak membuktikan adanya spending cap pada provider.

## Persona dan Mode Pemrosesan

### Persona

| Nilai API | Persona | Kegunaan |
| --- | --- | --- |
| `daily` | Smart Companion | Percakapan umum dan bantuan sehari-hari. |
| `report` | Academic Writer | Penulisan, struktur akademik, dan analisis. |
| `coding` | Coding Expert | Pemrograman, debugging, dan penjelasan teknis. |

### Mode

| Mode | Strategi | Maks. percobaan LLM | Maks. tool | Maks. revisi |
| --- | --- | ---: | ---: | ---: |
| **Fast** | Konteks relevan, generasi langsung, pemeriksaan programatis. | 2 | 2 | 0 |
| **Normal** | Analisis kebutuhan, bukti bila diperlukan, review bersyarat. | 4 | 4 | 1 |
| **Think** | Planner pada tugas kompleks, worker selektif, review dan perbaikan terarah. | 6 | 6 | 1 |

**Normal menjadi default.**

Batas tersebut merupakan plafon. Tugas sederhana dapat selesai dengan satu generasi pada semua mode. Tugas deterministik tertentu dapat selesai tanpa model.

Think memakai maksimal dua worker paralel ketika tugas berupa perbandingan dan rencana menghasilkan dua subtujuan independen. Penggunaan worker atau model berbeda tidak diwajibkan untuk setiap pesan.

Panjang jawaban mengikuti permintaan pengguna, termasuk ketika memakai Think.

### Anggaran mode

| Mode | Reservasi input total | Batas output total | Deadline | Konkurensi per request |
| --- | ---: | ---: | ---: | ---: |
| Fast | 48.000 | 4.096 | 30 detik | 1 |
| Normal | 120.000 | 10.240 | 45 detik | 1 |
| Think | 200.000 | 14.336 | 55 detik | 2 |

Input menggunakan estimasi konservatif byte teks beserta framing. Estimasi ini berbeda dari token yang dilaporkan gateway. Seluruh peran dan retry memakai anggaran yang sama.

Route mendeklarasikan `maxDuration=60`, sementara UI menunggu maksimal 65 detik. Batas eksekusi hosting sebenarnya tetap ditentukan deployment.

## Routing dan Kandidat Model

Server memilih model dari katalog berikut:

```text
gpt-4o-mini
gpt-4.1-mini
gpt-5-mini
gpt-5.4-mini
gpt-5.4
claude-haiku-4-5
claude-sonnet-5
claude-opus-5
gemini/gemini-3.5-flash
gemini/gemini-3.1-pro-preview
deepseek-v4-flash
deepseek-v4-pro
```

ID tersebut merupakan ID katalog gateway pada repo. Nama model atau keberadaannya dalam metadata tidak membuktikan dukungan semua kemampuan model resmi.

Perilaku routing:

- `off`: memakai baseline.
- `shadow`: mencatat rekomendasi tanpa mengganti baseline.
- `adaptive`: mengizinkan promosi berdasarkan bukti yang memenuhi policy.

Policy mempertimbangkan kategori tugas, konteks, modalitas, akses Frontier, kesehatan layanan, dan bukti perbandingan yang tersedia.

Catatan kemampuan historis dipertahankan. Native tools, parameter reasoning, atau kemampuan tambahan yang belum terverifikasi tetap berstatus unknown.

### Akses Frontier

Verifikasi AET membuat kandidat Frontier memenuhi syarat jika diaktifkan pengelola. Server tetap memeriksa akses pada setiap peran dan percobaan.

Think dapat berjalan dengan kandidat publik. Memilih Think tidak otomatis berarti menggunakan Frontier.

Klien lama boleh mengirim field `model` berupa string, tetapi nilainya diabaikan. Field tersebut tidak dapat mengambil alih policy server atau membuka akses Frontier.

## Konteks dan Riwayat

State percakapan memuat:

- Tujuan dan subtopik aktif.
- Batasan, format, bahasa, serta koreksi pengguna.
- Pernyataan lama yang telah digantikan.
- Keputusan, pekerjaan selesai, dan pekerjaan tertunda.
- Rujukan lampiran dan pesan asal.
- Asumsi, konflik, serta informasi yang belum diketahui.

State dibangun ulang dari cabang pesan yang valid. Cache state dari klien tidak dipercaya sebagai sumber kebenaran.

Context packet menggabungkan state relevan, pesan terbaru, cuplikan lama yang terkait, serta lampiran dan bukti yang diperlukan. Ekstraksi state dan relevansi masih bersifat heuristik.

Riwayat chat disimpan di **browser/perangkat yang sama**. Belum tersedia sinkronisasi chat lintas perangkat.

Pergantian Fast, Normal, dan Think mempertahankan percakapan. Migrasi riwayat memakai key v2 yang sama; percakapan lama tanpa mode respons mendapat Normal.

Data biner lampiran tidak disimpan dalam localStorage. Teks hasil ekstraksi dapat tetap tersimpan bersama percakapan.

## Lampiran dan Tools

### Lampiran

- PDF, DOCX, dan TXT: maksimal 5 MiB.
- PDF: maksimal 100 halaman.
- Teks ekstraksi: maksimal 24.000 karakter.
- PDF scan tanpa lapisan teks memerlukan OCR di luar aplikasi.
- Input gambar dibatasi pada kandidat yang memiliki catatan dukungan sesuai policy.

Reservasi token gambar belum dikalibrasi ulang pada gateway. Input gambar ditolak pada jalur yang memakai `AET_MAX_REQUEST_USD` sampai penghitungan token dan biayanya dapat dipertanggungjawabkan.

### Tools

- Pencarian web.
- Pembacaan halaman HTTPS dengan proteksi SSRF.
- Pengetahuan resmi dari `app/AETPCR.docx`.
- Cuaca dan kurs.
- Konversi satuan dan warna.
- Statistik sederhana.
- Aritmetika dengan grammar terbatas tanpa `eval`.
- Validasi format email.
- Password acak dengan generator kriptografis.

Sumber mencatat status dan cakupan. Cuplikan pencarian dibedakan dari halaman yang benar-benar dibaca.

Isi dokumen, web, state, dan hasil worker diperlakukan sebagai data tidak tepercaya.

## Pemeriksaan dan Streaming

Pemeriksaan dipilih berdasarkan kebutuhan tugas. Pemeriksaan programatis mencakup jawaban kosong, JSON-only, provenance URL/DOI, dan klaim menjalankan kode tanpa tool yang sesuai.

Verifier LLM bersifat advisory. URL yang valid atau persetujuan verifier tidak membuktikan bahwa seluruh klaim benar.

Draft ditahan sampai pemeriksaan yang dipilih selesai. SSE mengirim:

```text
status
sources
meta
delta
done
cancelled
error
```

Draft planner dan worker tidak ditampilkan sebagai jawaban final. Buffered publication dapat menambah waktu sampai token jawaban pertama.

Kegagalan sebelum stream dimulai menggunakan status HTTP error. Kegagalan setelah stream dimulai dikirim sebagai event `error` atau `cancelled`, tanpa `done`.

## Kontrak API Chat

Endpoint:

```text
POST /api/chat
```

Contoh payload:

```json
{
  "mode": "coding",
  "responseMode": "normal",
  "messages": [
    {
      "id": "user-1",
      "role": "user",
      "content": "Jelaskan perbedaan const dan let."
    }
  ]
}
```

Gunakan header berikut untuk SSE:

```http
Content-Type: application/json
Accept: text/event-stream
```

Ketentuan:

- `mode`: `daily`, `report`, atau `coding`.
- `responseMode`: `fast`, `normal`, atau `think`; default `normal`.
- `frontierAccessToken`: opsional.
- Pesan terakhir harus berupa permintaan pengguna.
- Pesan gagal, dibatalkan, atau belum selesai tidak boleh menjadi konteks lengkap.
- Maksimal 2.000 pesan, 40.000 karakter per pesan, dan 200.000 karakter gabungan teks/ekstraksi.
- Batas body request: 8 MiB.

## Pengujian Lokal

Tes inti orkestrasi, routing, keamanan, streaming, dan riwayat:

```bash
npm run test:adaptive
```

Seluruh quality gates:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:http
```

`test:http` dijalankan **sesudah build**. Skrip menggunakan database sementara dan gateway simulasi.

Jangan menjalankan build bersamaan dengan server yang memakai direktori `.next` yang sama.

## Evaluasi Kemampuan AI

### Rencana tanpa jaringan

```bash
npm run test:ai:plan
```

`npm run test:ai` tanpa argumen juga menghasilkan rencana tanpa jaringan.

Matriks default berisi:

```text
10 kasus × 4 varian × 3 pengulangan = 120 sampel chat
```

Varian pembanding: baseline, Fast, Normal, dan Think.

### Simulasi

```bash
npm run test:ai -- --mock --repeat 3 --max-requests 250
```

Simulasi menguji alur perangkat lunak menggunakan jawaban fixture. Latensi, usage, dan tarif mock tidak mewakili provider nyata.

Limiter per menit dinaikkan pada proses mock untuk batch yang dipercepat. Budget per request tetap mengikuti policy produksi.

### Menyiapkan live test

Isi `SUMOPOD_API_KEY`, lalu buat template:

```bash
npm run test:ai:setup
```

Template yang dibuat:

```text
evaluation/budget.json
evaluation/pricing.json
```

Setup tidak menimpa file yang sudah ada.

Sebelum mengaktifkan live test:

1. Gunakan key khusus dengan cap provider yang benar-benar ditegakkan.
2. Periksa cap tersebut langsung pada penyedia.
3. Isi fingerprint key, bukti pemeriksaan, dan waktu pemeriksaan pada budget.
4. Isi tarif gateway yang berlaku beserta sumber resminya.
5. Aktifkan attestasi operator hanya setelah pemeriksaan selesai.

Tambahkan environment:

```dotenv
AET_LIVE_TEST_APPROVED=true
AET_TEST_BUDGET_USD=3
AET_BENCHMARK_BUDGET_FILE=evaluation/budget.json
AET_BENCHMARK_PRICING_FILE=evaluation/pricing.json
```

Guard mengikuti batas maksimal USD 3 dari mekanisme repo. Angka environment saja tidak cukup untuk mengizinkan generasi berbayar.

### Pilot kecil

```bash
npm run test:ai -- --live --cases simple-fact,latest-correction,arithmetic --repeat 1 --max-requests 24
```

### Perbandingan tiga pengulangan

```bash
npm run test:ai -- --live --repeat 3 --max-requests 250
```

Seluruh planner, worker, verifier, revisi, dan retry masuk ke batas generasi global. Sel yang tidak dijalankan tetap dicatat sebagai BLOCKED.

Evaluasi ini memanggil layanan orkestrasi produksi secara langsung. Pengujian HTTP dan browser dilakukan terpisah.

### Hasil evaluasi

Hasil tersimpan dalam folder run unik:

```text
evaluation/run-<waktu>-<id>/
```

| Berkas | Isi |
| --- | --- |
| `report.json` | Jawaban, pemeriksaan objektif, metadata, usage, latensi, dan kegagalan setiap sampel. |
| `summary.md` | Ringkasan hasil dan keterbatasan. |
| `review.csv` | Lembar penilaian manusia tanpa label varian. |

Usage yang tidak dilaporkan tetap `null`. Biaya berdasarkan usage dan tarif dibedakan dari tagihan aktual provider.

Untuk analisis lanjutan, gunakan `report.json` serta `review.csv` yang telah diisi. Penilaian otomatis hanya mengukur syarat yang ditentukan fixture; kualitas umum dan dukungan semantik sumber tetap memerlukan review.

Panduan lengkap: [docs/AI_EVALUATION.md](docs/AI_EVALUATION.md).

### Benchmark 12 model

Rencana tanpa biaya:

```bash
npm run test:benchmark:plan
```

Template tarif seluruh kandidat:

```bash
npm run test:ai:setup -- --all-models
```

Benchmark:

```bash
npm run test:ai:models
```

Harness ini memakai 12 model × 8 kasus dan memerlukan guard serta tarif seluruh kandidat. Jika pricing.json sudah ada, tambahkan tarif yang belum tersedia secara manual karena setup tidak menimpanya.

## Menjalankan Production

Setelah konfigurasi dan quality gates diperiksa:

```bash
npm run build
npm start
```

Untuk deployment:

- Sesuaikan `APP_ORIGIN` dengan origin publik.
- Gunakan HTTPS untuk autentikasi admin production.
- Pertahankan `.env` dan database server milik deployment.
- Pasang dependency yang diperlukan untuk build dan runtime.
- Sesuaikan batas eksekusi serta timeout platform.
- Gunakan limiter bersama jika aplikasi berjalan pada beberapa proses atau replica.

Perubahan versi 2.2.0 tidak membutuhkan reset atau migrasi schema database.

## Status Validasi Terakhir

Hasil berikut berasal dari validasi **24 Oktober 2026**:

| Pemeriksaan | Hasil |
| --- | --- |
| Tes inti adaptif | **103/103 lulus** |
| Seluruh suite repo | **161 lulus, 7 gagal dari 168** |
| Parse sintaks TS/TSX/MTS/MJS | **123 berkas, 0 error** |
| Lint | Terblokir pada lingkungan validasi |
| Semantic TypeScript | Terblokir pada lingkungan validasi |
| Production build | Terblokir pada lingkungan validasi |
| Regresi HTTP setelah build | Belum dapat dijalankan |
| QA browser desktop/mobile | Belum dijalankan |
| Evaluasi provider live | Belum dijalankan |

Tujuh kegagalan suite lengkap terkait dependency parser dokumen dan rendering yang belum terpasang. Instalasi dependency pada lingkungan validasi ditolak HTTP 403.

Parse sintaks tidak menggantikan lint, semantic TypeScript, atau build. Hasil simulasi juga tidak membuktikan peningkatan kualitas, latensi, atau biaya model live.

Laporan lengkap: [docs/VALIDATION_20261024.md](docs/VALIDATION_20261024.md).

## Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [ADAPTIVE_ARCHITECTURE.md](docs/ADAPTIVE_ARCHITECTURE.md) | Arsitektur, mode, budget, routing, konteks, migrasi, dan batas implementasi. |
| [AI_EVALUATION.md](docs/AI_EVALUATION.md) | Setup, guard, pelaksanaan evaluasi, dan pembacaan hasil. |
| [VALIDATION_20261024.md](docs/VALIDATION_20261024.md) | Hasil validasi aktual dan pemeriksaan yang masih tertunda. |
| [APPLY_PATCH.md](docs/APPLY_PATCH.md) | Cara menggunakan patch terhadap ZIP masukan. |
| [README_INPUT_ARCHIVE.md](docs/README_INPUT_ARCHIVE.md) | Arsip README sebelum revisi. |

Catatan historis pada arsip tidak dianggap sebagai bukti validasi terbaru jika laporan pendukungnya tidak tersedia.