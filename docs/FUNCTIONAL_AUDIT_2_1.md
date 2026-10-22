## Audit lanjutan 2.1.1 — temuan baru yang diperbaiki

- **Sedang, output/context:** `responseLength` memperlakukan semua permintaan N kata sebagai singkat; esai 1000 kata mendapat 512 token. Batas kini menyesuaikan target kata dalam cap 4096. Intent permintaan dipisahkan dari isi dokumen.
- **Tinggi, resource/context:** attachment biner baru dihitung setelah seleksi riwayat; hasil ekstraksi dapat menembus batas. `prepareMessages` menghitung ulang setelah ekstraksi dan menolak pesan terakhir yang terlalu besar dengan CONTEXT_LIMIT.
- **Sedang, integrasi model:** smoke verifier menerima DONE walau finish_reason=length. Parser produksi kini dipakai untuk verifikasi; dua Gemini diuji ulang dengan 1024 token dan lulus.
- **Sedang, lifecycle:** client menunggu EOF walau event done sudah diterima. Reader kini selesai/cancel tepat pada done; payload SSE primitif ditolak.
- **Sedang, provenance:** meta sumber sebelumnya tidak diteruskan ke pesan. Sumber tools sekarang ditampilkan dalam detail sumber, ikut tersimpan, dan dibentuk dari tools nyata; link keluaran model bukan sumber terverifikasi.
- **Sedang, frontend race:** unggahan lambat dapat menempel setelah pergantian chat. Abort, request ID dan pemeriksaan percakapan membuang hasil unggah yang sudah usang.
- **Sedang, sitasi:** prompt saja masih menghasilkan DOI/metadata fiktif. Dua intent yang bermasalah ditangani `citation-policy.ts` secara deterministik. Ini kontrol terbatas, bukan validator bibliografi menyeluruh.
- **Sedang, vision:** hanya GPT-4o Mini lulus uji warna dan route aplikasi; diaktifkan pada model tersebut. GPT-4.1 Mini salah mengenali warna, tetap tidak diaktifkan. Riwayat gambar pada model teks menjadi penanda eksplisit, bukan input gambar palsu.
- **Rendah, performa/UX:** renderer chat semula ikut initial bundle beranda; dipisahkan dengan dynamic import dan status loading. Kegiatan yang sedang berlangsung kini diberi label yang tepat; tahun selalu WIB.
- **Rendah, bukti evaluasi:** checkpoint benchmark paralel dapat kehilangan satu rekaman. Penulisan akhir dibuat eksplisit; final capture menyimpan 60+60 respons.

Bukti final dan batas visual terdapat pada MASTER_PROMPT_COMPLETION_AUDIT.md dan REGRESSION_TEST_REPORT.md. Catatan di bawah berasal dari implementasi 2.1 sebelumnya.

---

# Functional audit 2.1

Tanggal finalisasi: 22 Oktober 2026 WIB. Baseline aktual: unggahan `aet-ai-signature-hybrid-redesign(2).zip` (folder `aetpcr/`); nama unggahan memakai suffix (2), sedangkan brief menyebut (1). Struktur dan dokumentasi redesign pada unggahan dipakai sebagai source of truth.

## Temuan dan hasil

| Risiko | Bukti baseline | Perbaikan dan bukti versi 2.1 |
| --- | --- | --- |
| Kritis | Cookie `admin_session` hanya diuji keberadaannya; CRUD tidak memeriksa sesi sendiri | HMAC, expiry, purpose terpisah, pemeriksaan server pada setiap mutasi; unit/security dan HTTP regression. |
| Tinggi | Berita draft dapat dibaca dari slug yang diketahui | GET publik hanya published; preview draft hanya sesi admin sah. |
| Tinggi | Scraper menerima tujuan tanpa pembatasan jaringan yang memadai | Validasi HTTPS, blok IP privat/reserved, DNS validation dan TLS pin, maksimal dua redirect, batas byte/waktu. |
| Tinggi | PDF dikirim sebagai image_url | Ekstraksi PDF/DOCX/TXT di server; file rusak/scan/enkripsi dan batas ukuran ditangani. |
| Tinggi | Error/truncation streaming dapat terlihat seperti jawaban selesai | Parser ketat, SSE meta/delta/done/error, status error/cancelled tidak menjadi konteks faktual. |
| Sedang | Prompt monolitik, emoji/klarifikasi/kode dipaksakan | Persona modular, format mengikuti tugas, kebijakan sitasi/ketidakpastian. Benchmark tidak menunjukkan peningkatan universal. |
| Sedang | Satu chat per mode; riwayat model lama rentan hilang | Store v2, migrasi key lama, multi-chat, label model retired dan pemilihan aktif eksplisit. |
| Sedang | Parameter sama untuk seluruh keluarga model | Output-limit sesuai keluarga yang telah diuji; temperature/reasoning/tools tidak ditebak. |
| Sedang | Validasi CMS, update konflik, zona waktu tidak konsisten | Validasi parsial, unique slug, optional If-Match, WIB eksplisit, ordering/socials aman. |
| Sedang | Secret dan request/biaya tidak dibatasi memadai | Konfigurasi fail-closed, body/rate/concurrency cap, Frontier off secara default. |
| Sedang | Dependency baseline memiliki advisory kritis | Next.js/React dan patch dependency diperbarui; sisa advisory dijelaskan dalam SECURITY_AUDIT_2_1.md. |

## Alur yang diperiksa

1. Chat: input/attachment → state → request tervalidasi → origin/rate/model/Frontier → konteks terpilih → tools/knowledge → satu request model → SSE → status pesan → persistence lokal.
2. CMS: form → JSON/upload → origin dan sesi sah → validasi field/versi → Prisma → respons → refresh form/list. Public API memisahkan draft dari published.
3. Dokumen: pemilihan → endpoint ekstraksi → MIME/signature/ukuran → teks tidak tepercaya → prompt; tidak ada PDF yang disamarkan sebagai gambar.
4. Riwayat: key lama tidak ditimpa; store rusak mempertahankan data mentah dan menonaktifkan penulisan sesi; retry menggunakan pesan pengguna terakhir sekali.

Desain Signature Hybrid, komponen layout, renderer Markdown/KaTeX/Mermaid, syntax highlighting, viewer, dan navigasi dipertahankan. Keterbatasan pengujian browser dan layanan nyata tercatat dalam REGRESSION_TEST_REPORT.md.
