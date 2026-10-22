## Verifikasi patch 2.1.1

Tidak ada perubahan Prisma schema, migration, reset atau seed. Hash SQLite dan schema final masih identik dengan tabel di bawah. Semua mutasi CMS HTTP menggunakan database salinan sementara. Pengujian live aplikasi serta preview juga diarahkan ke salinan. Perubahan persona, gambar, sumber dan riwayat tidak memerlukan migrasi SQLite.

Versi penyimpanan riwayat tetap v2; field sources tambahan bersifat opsional. Key lama tidak dihapus, dan byte lampiran tetap tidak disimpan pada localStorage. Teks dokumen tetap tersimpan; gambar/file perlu diunggah ulang setelah biner tidak tersedia. Recovery dan instruksi update server di bawah tetap berlaku.

---

# Database preservation and migration 2.1

**Tidak ada perubahan schema atau migrasi database pada versi ini.** SQLite dan Prisma 5 dipertahankan; modul Client dipindahkan ke dependencies runtime. `prisma/dev.db` dan `prisma/schema.prisma` identik byte demi byte dengan baseline.

| File | SHA-256 baseline dan final |
| --- | --- |
| prisma/dev.db | dc579014c71daa611b500c291e6e3878678da4d9ba8d2f9a4a87dd9ad0b2f45e |
| prisma/schema.prisma | e967a45b5ec1ed380efb9c6f354846f597e2067b124940280459bea28caa3b70 |

HTTP regression memakai salinan SQLite sementara dalam direktori OS, lalu menghapusnya. Tidak menjalankan prisma migrate reset, seeding, reset, atau operasi destruktif pada database asli. Berita/kegiatan/tim asli tidak dipakai sebagai sasaran CRUD pengujian.

## Pembaruan source server

1. Hentikan writer dan backup SQLite dengan SQLite backup API atau salinan konsisten saat aplikasi berhenti; sertakan WAL/SHM bila masih digunakan.
2. Simpan environment/secrets milik server. Jangan menimpa database server yang lebih baru dengan dev.db dari paket.
3. Pasang source/dependency, jalankan prisma generate, type/build checks, dan hubungkan DATABASE_URL ke database existing.
4. Uji login, baca publik, dan satu konten percobaan yang memang disposable sebelum membuka trafik.
5. Recovery: pulihkan source/lockfile/environment sebelumnya dan snapshot database konsisten. Rotasi secret membatalkan token terkait.

Migrasi percakapan bersifat browser-local, bukan Prisma: key lama `aet_ai_chat_history_<mode>` disalin ke store `aet_ai_conversations_v2_<mode>` tanpa menghapus key lama. ID/timestamp/isi dan model historis dipertahankan; store rusak tidak ditimpa. Tidak ada cloud sync pengguna.
