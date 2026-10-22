# Status pemeriksaan antarmuka 2.1.1

Halaman awal AET Signature Hybrid dapat diamati pada browser desktop; tiga kartu mode, navigasi dan tata letak terang tetap ada. Pada pemeriksaan awal, modul chat/renderer berat ikut dimuat pada halaman beranda. ChatInterface kemudian dipisahkan melalui dynamic import sehingga beranda tidak harus memuat renderer matematika, kode dan Mermaid terlebih dahulu, dan perpindahan mode memiliki status pemuatan yang terlihat.

Percobaan melanjutkan QA browser setelah preview dimulai kembali ditolak oleh kebijakan akses URL browser. Pemeriksaan dihentikan. Tidak ada klaim bahwa klik kirim/edit/retry/modal/sumber atau responsivitas mobile final telah diuji secara visual sampai selesai. Screenshot arsip bukan bukti fitur patch ini.

Yang terbukti lewat unit/integrasi/build: metadata sumber dibentuk hanya dari tools yang dijalankan, parser SSE selesai pada done, model tanpa dukungan gambar ditolak, input gambar model yang terverifikasi diterima, error dan konteks dibatasi, tipe komponen serta production build valid. Pengujian browser lengkap tetap perlu dilakukan pada lingkungan yang mengizinkan interaksi.

Daftar verifikasi operator: tiga mode; kirim/hentikan/edit/coba ulang; daftar/ganti nama/hapus/pindah percakapan; pemulihan riwayat lama; dropdown model dan verifikasi Frontier; unggah TXT/PDF/DOCX/gambar; buka sumber; KaTeX/Mermaid/kode; admin CMS; viewport desktop dan ponsel. Gunakan data percobaan dan database salinan.
