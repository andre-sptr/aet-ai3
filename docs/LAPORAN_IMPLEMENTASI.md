> **ARSIP BASELINE REDESIGN.** Dokumen ini menjelaskan tahap sebelum 2.1. Untuk hasil terkini baca FINAL_IMPLEMENTATION_REPORT.md dan REGRESSION_TEST_REPORT.md.

# Laporan implementasi AET AI — Signature Hybrid

Tanggal pengerjaan: 21 Oktober 2026. Sumber: arsip `aetpcr(1).zip` dan instruksi redesign yang dilampirkan.

## Hasil

Redesign diimplementasikan pada source aplikasi Next.js yang diberikan, mencakup landing page, ketiga mode chat, listing dan detail berita/kegiatan, tim, coming soon, login, dashboard, dan tiga editor admin. Tema terang menjadi dasar, dengan identitas biru PCR serta navy pada area penekanan.

Paket akhir merupakan proyek lengkap. Backend, schema, database, daftar model, request contracts, serta versi dependencies dipertahankan. Pembandingan SHA-256 membuktikan 22 file yang dilindungi identik dengan sumber. Database `prisma/dev.db` tidak dipakai untuk mutasi pengujian.

## Temuan audit dan keputusan implementasi

| Area | Kondisi source | Keputusan |
| --- | --- | --- |
| Home / chat | Pergantian komponen menggunakan React state pada `/` | Tetap menggunakan mekanisme tersebut; tidak membuat route `/chat`. |
| Riwayat | Satu riwayat per mode dalam localStorage | Pertahankan key, schema, dan pengosongan data biner attachment sebelum penyimpanan. |
| Model | Katalog pada `lib/ai-models.ts` dengan model Frontier | Seluruh ID dan katalog tetap; tambahkan pencarian frontend, metadata provider, dan penanda terkunci. |
| Frontier | Verifikasi jawaban, token bertanda tangan, masa berlaku | Backend dan token dipertahankan; tampilan memakai dialog aksesibel. |
| Event detail | Segment route bernama `slug`, lookup sebenarnya memakai `id` | Pertahankan lookup ID dan link `/events/{id}`. |
| Berita | Listing hanya menampilkan `published: true` | Query listing tetap. Pencarian detail berdasarkan slug tetap. |
| Tim | Urutan menurut `order`; socials berupa string opsional | Urutan tetap. JSON socials valid berisi URL HTTP(S) dapat ditampilkan; editor tidak mengirim ulang field socials. |
| Coming soon | Form email hanya memakai timeout dan tidak menyimpan email | Hapus simulasi pendaftaran dan link `#`; pertahankan tautan pengembang yang berfungsi. |
| Branding | Logo AET ada pada favicon; klaim provider/status sebagian statis | Gunakan logo asli. Hapus klaim provider tunggal, status online, dan angka tools yang tidak didukung pengukuran. |
| Font / matematika | Font diambil saat build; KaTeX stylesheet dari CDN | Plus Jakarta Sans dibundel lokal dengan lisensi OFL; impor CSS KaTeX dari dependency existing. |
| Admin mobile | Sidebar existing tersembunyi tanpa pengganti | Tambahkan drawer mobile, navigasi keyboard, dan konfirmasi hapus. |

## Perubahan halaman

### Landing page

- Navbar bersama dengan wordmark AET AI, route publik, CTA pemilihan mode, dan drawer mobile.
- Hero dua kolom: headline, penjelasan berbahasa Indonesia, CTA, dan panel navy yang diberi label pratinjau interface.
- Tiga kartu mode dengan ID existing: `daily`, `report`, dan `coding`.
- Alur penggunaan ringkas, pengenalan komunitas, saluran sosial asli, peta dengan URL source, CTA akhir, dan footer.
- Hilangkan penundaan skeleton buatan untuk kartu mode yang datanya sudah tersedia lokal.

### Chat

- Shell workspace dengan rail desktop yang menggambarkan riwayat mode sebenarnya, header, ruang baca terkontrol, dan composer.
- Respons AI memakai permukaan netral; pesan pengguna memakai biru lembut.
- Contoh prompt hanya mengisi composer; pengguna tetap menentukan kapan mengirim.
- Model picker dapat dicari, di-scroll, dioperasikan dengan tombol panah dan Escape; posisi dijaga di dalam viewport.
- Dialog Frontier dan konfirmasi hapus memakai native dialog, portal ke body, focus containment, Escape, dan pengembalian fokus.
- Renderer Markdown, GFM, KaTeX, syntax highlighting, tabel, HTML preview sandbox, Mermaid, gambar, video, attachment, copy, edit, retry, dan speech synthesis tetap tersedia.
- Viewer gambar dan diagram memakai zoom, reset, drag/pan berbasis pointer, serta action download.
- Pengiriman pesan, streaming, history payload, token Frontier, penanganan error, dan auto-resize textarea tetap terhubung ke handler existing.
- Enter mengirim pesan; Shift+Enter menambah baris. Pengiriman dicegah ketika attachment masih diproses.
- Penyimpanan browser yang tidak tersedia/penuh memberi feedback. Key `aet_ai_chat_history_${mode}` dan `aet_ai_frontier_access_token` tetap.
- Regenerate ditampilkan untuk respons percakapan yang memiliki pesan pengguna; sapaan awal tidak menawarkan request ulang yang kosong.

### Halaman publik

- Navigasi dan footer konsisten untuk semua halaman.
- Berita menampilkan artikel utama dengan komposisi editorial, tanggal aktual, ringkasan, gambar, dan empty state.
- Detail artikel menggunakan lebar baca yang nyaman, gambar responsif, styling Markdown bersama, dan share control existing.
- Listing kegiatan memuat tanggal, jam, lokasi, dan penanda masa lalu/mendatang dari data tanggal.
- Detail kegiatan mempertahankan lookup ID dan format waktu existing.
- Tim menampilkan data asli, foto atau inisial bila foto tidak ada, jabatan, bio, dan socials yang valid.
- Coming soon tidak menampilkan pendaftaran atau integrasi yang belum tersedia.

### Login dan admin

- Login dua panel dengan label dan autocomplete yang sesuai, loading, error, serta request `{username,password}` existing.
- Sidebar desktop dan drawer mobile menggunakan menu Dashboard, Berita, Kegiatan, dan Struktur tim.
- Dashboard menggunakan count Prisma aktual; tidak menambah grafik atau analytics buatan.
- `ContentManager` menyatukan editor dan listing tiga jenis konten, dengan field dan endpoint masing-masing.
- Create/edit/delete, status publish, upload gambar, preview, form reset, dan refresh daftar tetap berjalan.
- Dialog delete, feedback sukses/gagal, loading daftar, retry pemuatan, serta pencegahan submit ganda ditambahkan.
- Slug berita tetap dihasilkan otomatis dan read-only seperti source. Konversi waktu event untuk `datetime-local` dipertahankan.
- Tabel memiliki container scroll sendiri pada layar kecil; input upload tersembunyi tidak lagi menyebabkan body melebar.

## Arsitektur frontend

Komponen baru:

| Komponen | Tanggung jawab |
| --- | --- |
| `components/layout/Brand.tsx` | Identitas AET AI / AET Admin dengan logo existing. |
| `components/layout/PublicNavigation.tsx` | Navigasi publik desktop dan mobile. |
| `components/layout/Footer.tsx` | Footer publik bersama. |
| `components/layout/PublicPage.tsx` | Shell publik, page intro, dan empty state. |
| `components/shared/Dialog.tsx` | Dialog native di portal, fokus, Escape, dan busy state. |
| `components/shared/MediaViewer.tsx` | Viewer gambar/diagram, zoom, reset, pan, download. |
| `components/shared/ArticleContent.tsx` | Typography dan rendering konten editorial. |
| `components/admin/ContentManager.tsx` | Form dan daftar konten admin dengan konfigurasi tipe konten. |

Global CSS menyimpan token, komposisi halaman, responsivitas, fokus keyboard, dan reduced-motion. Server components tetap dipakai pada listing/detail publik dan dashboard. Client components digunakan untuk chat, navigasi interaktif, login, serta form admin. Tidak ada dependency runtime baru dan tidak ada migrasi framework.

Inventaris lengkap berada di `DAFTAR_PERUBAHAN.md`: 21 file existing diubah dan 11 file aplikasi/konfigurasi/aset ditambahkan, di luar dokumentasi.

## Pengujian

### Pemeriksaan otomatis akhir

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | PASS; tidak ada error atau warning ESLint. |
| `npm run test` | PASS; 7 dari 7 pengujian existing. |
| `npm run build` | PASS; production build Next.js 16 dengan React Compiler. |
| `npx tsc --noEmit` | PASS. |
| Integritas file yang dilindungi | PASS; 22 dari 22 identik byte demi byte. |
| Pemeriksaan HTTP tambahan | PASS; 41 dari 41 pada salinan DB dan gateway AI simulasi lokal. |

Rincian 41 pemeriksaan tersedia di `http-regression-results.json`. Cakupannya meliputi login benar/salah dengan akun uji lokal, cookie dan proteksi admin, CRUD tiga tipe konten, refresh daftar, publish/unpublish, detail slug berita dan ID kegiatan, model tidak dikenal, Frontier tanpa token, validasi jawaban Frontier, request berizin token, streaming ketiga mode, upstream error, logout, enam route publik, serta 404 untuk konten tidak ditemukan.

Akun uji dan API key simulasi hanya dipakai pada lingkungan pengujian. Keduanya tidak membuktikan akses ke akun atau layanan produksi. Route simulasi, wrapper preview, dan database pengujian telah dikeluarkan dari proyek akhir.

### Pemeriksaan interaksi browser

Diperiksa pada desktop sekitar 1363 px, viewport responsif 1024 px, 390 px, dan 320 px. Mobile diperiksa menggunakan iframe berukuran viewport pada browser desktop; ini menguji layout responsif, bukan perangkat fisik.

- Navigasi dan kartu mode membuka workspace yang sesuai.
- Drawer publik dan admin membuka/menutup; dialog memiliki fokus awal dan Escape.
- Dropdown model dapat dicari; model Frontier tetap memunculkan verifikasi.
- Pada 390 px, dropdown berada pada x=16 hingga x=374 dalam viewport 390 px.
- Kirim pesan dan streaming melalui gateway simulasi, edit lalu kirim ulang, regenerate, serta feedback error berhasil ditampilkan.
- Riwayat Coding Expert dimuat kembali saat mode dibuka dari konteks halaman lain pada browser yang sama.
- Clear chat mereset percakapan pengujian Smart Companion ke sapaan awal.
- Shift+Enter menambah newline dan Enter mengirim.
- Gambar dipilih, dikompresi menjadi JPEG data URL, ditampilkan, dan dikirim; PDF dapat dipilih, ditampilkan, serta dikirim melalui jalur simulasi.
- Clipboard code copy diperiksa dan menghasilkan isi kode yang benar.
- KaTeX, tabel Markdown, syntax highlighting, dan Mermaid dirender pada fixture komponen aktual.
- Viewer gambar/diagram membuka, zoom menunjukkan 120%, reset, serta Escape berfungsi.
- Form edit berita memuat data aktual, gambar, dan status publikasi; tabel admin berada dalam scroll container.
- Overflow editor akibat hidden file input ditemukan dan diperbaiki; pengukuran body sesudah perbaikan tidak melampaui viewport.
- Dialog gambar yang sebelumnya tersisip dalam paragraf Markdown dipindahkan ke portal. Pemeriksaan sesudah perbaikan tidak menunjukkan peringatan nesting HTML baru.

### NOT VERIFIED

- Respons Sumopod sungguhan, kecocokan semua model dengan akun pengguna, billing/kuota, dan kualitas jawaban model.
- Tool eksternal seperti Tavily, cuaca, kurs, dan scraping terhadap layanan nyata.
- Upload gambar admin ke Vercel Blob dengan token produksi.
- Kamera perangkat fisik, keyboard virtual iOS/Android, audio speech synthesis, dan pemutaran output video nyata.
- Penyelesaian download SVG: action di browser diuji, tetapi event unduhan tidak dapat dikonfirmasi oleh lingkungan otomasi. Download lintas origin untuk gambar juga belum diverifikasi.
- Matriks seluruh browser, perangkat, dan ukuran 1920 px; audit WCAG formal dan pengukuran Lighthouse.

### Batas PDF pada source aktual

Composer menerima gambar dan PDF, dan dukungan ini dipertahankan. Namun `app/api/chat/route.ts` pada ZIP yang diberikan mengirim attachment sebagai bagian `image_url`; tidak ditemukan jalur ekstraksi teks PDF pada handler tersebut. Pengiriman PDF pada pengujian simulasi tidak membuktikan parsing PDF oleh model sungguhan. Jalur backend ini tidak diubah dalam redesign frontend. Klaim bahwa semua format dokumen sudah dapat diproses tidak dibuat.

## Temuan backend untuk pekerjaan lanjutan

Sesuai batas scope, temuan berikut dicatat tanpa perubahan tersembunyi pada backend:

1. Proxy admin memeriksa keberadaan cookie `admin_session`; source belum memakai session bertanda tangan. Handler CRUD dan upload tidak memiliki pemeriksaan session sendiri.
2. Detail berita memakai `findUnique({slug})` tanpa filter `published`; artikel draf dengan URL yang diketahui dapat diakses seperti perilaku source.
3. Secret Frontier memiliki fallback lokal; environment produksi sebaiknya menetapkan `AET_FRONTIER_ACCESS_SECRET` privat.
4. Format waktu publik mengikuti source; label WIB belum disertai penetapan `timeZone` eksplisit pada formatter. Penyelarasan zona waktu perlu keputusan terpisah agar data tidak bergeser diam-diam.
5. Format attachment PDF perlu diverifikasi dengan kontrak multimodal gateway sebelum dukungan ekstraksi dokumen dinyatakan tersedia.

## Dokumentasi visual

Tujuh screenshot berasal dari implementasi yang dijalankan:

| File | Tampilan |
| --- | --- |
| `screenshots/landing-desktop.jpg` | Landing desktop. |
| `screenshots/landing-mobile.jpg` | Landing pada viewport 390 px. |
| `screenshots/chat-desktop.jpg` | Coding Expert desktop dengan respons simulasi lokal. |
| `screenshots/chat-mobile.jpg` | Chat pada viewport 390 px. |
| `screenshots/news.jpg` | Listing berita dengan artikel dan cover asli database. |
| `screenshots/admin-dashboard.jpg` | Dashboard dengan count aktual pada salinan database. |
| `screenshots/admin-editor.jpg` | Editor berita terisi data aktual. |

Screenshot admin dirender melalui harness visual lokal yang memakai komponen dashboard/editor yang sama. Harness tidak disertakan dalam ZIP. Proteksi route admin dan login diuji terpisah melalui HTTP. Screenshot tidak menggambarkan sesi akun produksi pengguna.

## Menjalankan hasil

Ikuti `README.md` di root proyek. Inti langkahnya: salin `.env.example` ke `.env`, isi kredensial milik pengelola, jalankan `npm ci`, `npx prisma generate`, dan `npm run dev`. Untuk produksi, gunakan `npm run build` lalu `npm start`.

Database existing sudah disertakan. Jangan melakukan reset schema atau menimpa database produksi dengan database bawaan arsip jika server memiliki data yang lebih baru. Tidak ada domain production yang dikarang untuk metadataBase.
