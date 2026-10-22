## 2.1.1 — audit dan penyelesaian master prompt, 22 Oktober 2026

- Koreksi budget output untuk permintaan jumlah kata dan headroom Gemini minimum 1024.
- Penghitungan konteks sesudah ekstraksi dokumen; batas akhir benar-benar ditegakkan.
- Input gambar GPT-4o Mini aktif setelah uji gateway dan route aplikasi; model lain tetap dibatasi.
- Gambar historis yang tidak disertakan diberi penanda eksplisit, maksimal empat gambar terbaru.
- Provenance tools ditampilkan dan tersimpan pada pesan; tidak berasal dari link karangan model.
- Unggahan dibatalkan/dibuang setelah pergantian percakapan; input keyboard tidak menambah pesan saat model lama tidak aktif.
- SSE client berhenti pada done, menolak payload primitif, dan membatalkan reader.
- Tool cancellation, negasi intent, DNS timeout dan response aborted handling diperkuat.
- Respons terkontrol APA placeholder dan penolakan membuat DOI setelah failure benchmark ditemukan.
- Beranda memuat chat secara dinamis; status kegiatan berlangsung dan tahun WIB diperbaiki.
- Verifier model memakai parser produksi; checkpoint benchmark ditulis final agar tidak kehilangan respons.
- Pengujian menjadi 77 unit, 84 HTTP dan 9 skenario aplikasi + Sumopod asli. Final benchmark 60 pasangan + dua respons sitasi terkontrol. Database serta desain dipertahankan.
- Batas browser final, layanan eksternal, dependency dan kualitas model dicatat tanpa mengklaim semuanya terverifikasi.

---

# Changelog 2.1

Finalisasi 22 Oktober 2026 WIB dari baseline redesign unggahan.

- Autentikasi admin HMAC/expiry, origin checks, proteksi setiap mutasi, login/rate/body/concurrency caps, dan secret Frontier tanpa fallback.
- Draft berita terlindungi; CRUD tervalidasi, konflik update, parsial update, ordering/socials, WIB eksplisit, upload MIME/signature/size aman.
- Katalog 12 model yang diminta; live streaming smoke, metadata capability jujur, default GPT-4o Mini, model retired tetap terbaca, Frontier opt-in.
- Adapter request sesuai keluarga; SSE parser dan lifecycle cancel/error/retry diperbaiki.
- Persona core/daily/report/coding terpisah; kebijakan bahasa, format, sitasi, konteks, evidence, dan panjang adaptif.
- Router tools konservatif, scraper SSRF protection, password kriptografis, retrieval AET caching/lexical.
- Ekstraksi PDF/DOCX/TXT server-side dan error untuk scan/enkripsi/berkas tidak valid.
- Multi-chat local-first, migrasi riwayat, new/rename/delete/search/switch, message ID aman pada HTTP lokal, stale response protection.
- Next.js 16.4.2, React 19.3.1, KaTeX 0.18.2, patch lockfile kompatibel; advisory residual dicatat.
- Inisialisasi state eksternal chat/CMS dijadwalkan setelah mount dan dibatalkan bila komponen sudah unmount untuk kompatibilitas aturan React terbaru.
- Unit, production HTTP regression dengan DB salinan, 60-prompt paired benchmark, targeted refinement, pemeriksaan deterministik dan eksekusi snippet terpilih.
- Source harness/route QA temporer, test DB, env secret, node_modules dan build cache tidak masuk paket.

Layout dan identitas AET Signature Hybrid dipertahankan. Schema dan database original tidak berubah. Rincian hasil dan keterbatasan ada dalam laporan final; fitur tidak dianggap terverifikasi hanya karena ditulis.
