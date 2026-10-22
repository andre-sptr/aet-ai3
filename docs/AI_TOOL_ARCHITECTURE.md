## Pembaruan 2.1.1

`runTools(text, signal)` meneruskan pembatalan ke fetch boundedJson dan scraper yang aman. Instruksi negatif seperti jangan konversi tidak menjalankan alat. URL dengan tanda baca akhir kalimat dibersihkan sebelum scraping. DNS/response/redirect tetap memiliki batas waktu, ukuran dan validasi tujuan; keamanan SSRF tidak dikurangi agar lolos lingkungan tes.

`evidenceSources` mengubah evidence terstruktur menjadi provenance publik: tautan hasil pencarian yang sebenarnya, sumber resmi AET, kalkulasi lokal atau status gagal. UI menyimpannya bersama pesan dan menampilkan detail sumber. DOI/kutipan yang dibuat model tidak otomatis dipromosikan sebagai sumber.

Harness `npm run test:tools`: lima tool deterministik lulus. Cuaca timeout, kurs gagal, scraper tidak berhasil dijangkau pada lingkungan eksekusi; Tavily belum memiliki key. Keempatnya dicatat BLOCKED dan model menerima evidence gagal agar tidak mengarang hasil. Bukti: external-tools-current.json.

Kebijakan sitasi terkontrol adalah logika respons aplikasi yang terpisah dari tools; tidak mengklaim melakukan pencarian atau registrasi DOI. Penggunaan password tetap memakai node:crypto, langsung dijawab server dan tidak membutuhkan request model. Native function calling belum diaktifkan karena belum diuji.

---

# AI tool architecture 2.1

`routeTools` mendeteksi intent eksplisit dan memvalidasi argumen → `runTools` mengeksekusi maksimal dua tool → evidence berisi kind/source/status/data → prompt JSON tidak tepercaya → respons menyertakan fakta/sumber yang tersedia. Tidak ada native function calling yang diasumsikan.

| Tool | Validasi dan sumber |
| --- | --- |
| Unit | Dimensi panjang/massa/suhu; angka finite, nol/negatif, batas nol absolut. |
| Statistics | Maksimal 1.000 angka; count/sum/mean/median/min/max. |
| Password | node:crypto randomInt, 12–128 karakter, kelas karakter dan shuffle; dikembalikan langsung tanpa model. |
| Email | Sintaks saja, bukan keberadaan mailbox. |
| Color | HEX enam digit ke RGB. |
| Web | HTTPS publik dengan DNS/IP pinning, ukuran/waktu/redirect dibatasi; sumber URL asal. |
| Search | Tavily dengan API key server, maksimal tiga cuplikan, tanpa jawaban AI penyedia. |
| Weather | Open-Meteo geocoding dan cuaca, kota tervalidasi. |
| Currency | Frankfurter; hanya mata uang yang tersedia di layanan, tanggal kurs dilaporkan. |

Kode fenced dan permintaan penjelasan seperti “jelaskan cara” tidak memicu tool eksternal. Ini router konservatif; beberapa variasi bahasa dapat tidak terdeteksi. Kegagalan tool menjadi status error, bukan hasil rekaan. Metadata SSE mencantumkan provenance; hasil web/dokumen tidak berhak menjalankan perintah aplikasi.

Dokumen resmi AETPCR.docx dibaca dengan Mammoth, dicache menurut mtime/size, dikelompokkan menjadi cuplikan, dan dipilih secara lexical saat intent organisasi/follow-up relevan. Maksimal 12.000 karakter evidence. Sumber proyek disertakan dan informasi yang tidak ditemukan tidak boleh ditebak.

Unit/security menguji routing, angka, password, boundary injection, dan blok alamat privat. Layanan cuaca/kurs/Tavily/scraping dan Vercel Blob nyata belum diverifikasi end-to-end pada akun produksi. DNS awal di scraper belum mempunyai timeout resolver khusus; timeout transfer mulai setelah resolusi.
