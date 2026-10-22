# Kompatibilitas Sumopod — final 2.1.1

Endpoint server tetap https://ai.sumopod.com/v1/chat/completions. API key hanya dibaca dari SUMOPOD_API_KEY. Client lama tetap menerima text/plain; client AET baru meminta SSE meta/delta/done/error. Tidak ada fallback model otomatis.

| Model | Parameter output yang diuji | Ketentuan |
| --- | --- | --- |
| gpt-5* | max_completion_tokens | 16–4096, mengikuti tugas |
| gemini/* | max_tokens | Minimal 1024 setelah uji nyata cap kecil gagal; maksimum 4096 |
| Kandidat lain | max_tokens | 16–4096, mengikuti tugas |

Temperature, reasoning dan native tools tidak dikirim tanpa verifikasi gateway. Permintaan jumlah kata menambah ruang output dalam batas 4096; panjang jawaban tetap dapat tidak persis. Intent pengguna dipisahkan dari teks dokumen agar isi lampiran tidak mengubah alokasi berdasarkan instruksi yang kebetulan terdapat dalam dokumen.

GPT-4o Mini menerima image_url content parts yang telah lulus uji warna langsung dan pengujian melalui route produksi aplikasi. Hanya model ini mengaktifkan gambar. Model lain tetap memberi pesan kemampuan yang jelas. Maksimal empat gambar terbaru disertakan per request; gambar lama yang tidak disertakan ditandai, dan file historis yang tidak memiliki biner tidak dianggap telah dilihat. PDF/DOCX/TXT selalu diekstrak sebagai teks, bukan disamarkan sebagai gambar.

Parser menangani batas UTF-8/chunk, SSE multiline, empty frames, DONE/stop, malformed data, error, output length/content_filter dan EOF terputus. Parser client berhenti dan melepaskan reader pada done meskipun socket belum ditutup, serta menolak payload primitif. Meta mencatat model, pengurangan konteks, dan provenance tools. Field sumber tambahan kompatibel dengan client yang mengabaikannya.

Timeout total chat 60 detik; pembatalan diteruskan ke fetch tools/scraper dan upstream. Tool memiliki batas ukuran/waktu. Konteks dihitung lagi setelah ekstraksi lampiran, sehingga biner tanpa extractedText client tidak dapat melampaui batas teks server secara diam-diam. Respons gagal/parsial tidak menjadi konteks fakta.

Bukti: model-verification-final.json, vision-verification-current.json, live-app-current.json dan http-regression-2-1.json. Throughput produksi, tarif/tagihan, gambar kompleks, parameter lain serta native tools belum terverifikasi.
