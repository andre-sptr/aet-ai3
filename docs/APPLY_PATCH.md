# Memakai ZIP atau patch

ZIP berisi source lengkap yang telah direvisi. Kerjakan pada salinan checkout terlebih dahulu, pertahankan `.env` dan database server Anda sendiri, lalu jalankan quality gates yang masih tertunda.

Patch `AETAI_Adaptive_Changes.patch` dibuat terhadap isi ZIP masukan (HEAD 0147f5b9b3ab0073bfce05ca79a38f2cc6a04563 dengan line ending masukan). Dari root checkout yang sesuai:

```bash
git apply --check --ignore-whitespace AETAI_Adaptive_Changes.patch
git apply --ignore-whitespace AETAI_Adaptive_Changes.patch
```

`--ignore-whitespace` membantu konteks CRLF dari ZIP Windows. Jika checkout Anda sudah berisi perubahan lain yang bertabrakan, tangani konflik pada salinan kerja; jangan menimpa perubahan server secara membabi buta. Patch tidak mengubah database, schema Prisma, secret, auth, dokumen AET atau endpoint upload. Nomor versi root menjadi 2.2.0; graph dependency tidak diubah.

Patch telah diperiksa dengan `git apply --check` dan diterapkan pada salinan sementara ZIP asli. Tidak ada commit, push atau deployment yang dilakukan. Laporan keterbatasan pengujian tetap berlaku sesudah patch diterapkan.
