# Katalog model final — 2.1.1

Hanya 12 kandidat persis dari master prompt. Semua lulus chat teks dan streaming pada pengujian saat ini. Tidak ada model tambahan, embedding, substitusi ID provider, atau fallback diam-diam. Default tetap gpt-4o-mini. Bukti final: model-verification-final.json.

| ID | Tampilan | Akses | Input gambar di aplikasi |
| --- | --- | --- | --- |
| gpt-4o-mini | GPT-4o Mini | Public, Fast / Everyday, default | Aktif, lulus uji dasar gateway dan route aplikasi |
| gpt-4.1-mini | GPT-4.1 Mini | Public, Balanced | Belum terverifikasi; uji warna salah, tetap diblokir |
| gpt-5-mini | GPT-5 Mini | Public, Balanced | Belum terverifikasi |
| gpt-5.4-mini | GPT-5.4 Mini | Public, Balanced | Belum terverifikasi |
| gpt-5.4 | GPT-5.4 | Frontier | Belum terverifikasi |
| claude-haiku-4-5 | Claude Haiku 4.5 | Public, Fast / Everyday | Belum terverifikasi |
| claude-sonnet-5 | Claude Sonnet 5 | Frontier | Belum terverifikasi |
| claude-opus-5 | Claude Opus 5 | Frontier | Belum terverifikasi |
| gemini/gemini-3.5-flash | Gemini 3.5 Flash | Public, Fast / Everyday | Belum terverifikasi |
| gemini/gemini-3.1-pro-preview | Gemini 3.1 Pro Preview | Frontier | Belum terverifikasi |
| deepseek-v4-flash | DeepSeek V4 Flash | Public, Fast / Everyday | Belum terverifikasi |
| deepseek-v4-pro | DeepSeek V4 Pro | Frontier | Belum terverifikasi |

Teks/stream: 12/12. Vision: satu dari dua model yang diperiksa lulus. Keberhasilan mengenali fixture warna bukan benchmark akurasi vision menyeluruh. Native tool calling dan reasoning parameters masih unknown; tidak dikirim. Relative cost tetap unknown. Kapasitas konteks katalog berasal dari metadata gateway terdahulu yang disertakan source, bukan uji kapasitas konteks aktual; aplikasi memakai batas konservatif sendiri.

Tier adalah pengelompokan penggunaan dan kebijakan akses pengelola yang dipertahankan dari baseline, bukan hasil ranking kualitas atau tarif yang terverifikasi. Frontier tetap default off sampai pengelola mengaktifkan kebijakan biaya dan signing secret. Kuis bukan autentikasi identitas pengguna umum.

Gemini sempat menghasilkan finish_reason=length atau jawaban kosong dengan cap 64. Kedua kandidat lulus ulang dengan 1024; konfigurasi produksi memakai minimum 1024 untuk keluarga Gemini. Parameter temperature/reasoning tidak ditebak. Model lama tetap terbaca di riwayat, diberi label model lama, dan membutuhkan pilihan model aktif untuk respons berikutnya.
