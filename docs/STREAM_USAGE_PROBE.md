# Diagnosis usage streaming AETAI

File tambahan ini membandingkan dua request kecil pada satu model:

1. Request streaming tanpa opsi usage (kontrol eksplisit).
2. Request yang sama dengan stream_options.include_usage=true.

Opsi tersebut mengikuti kontrak Chat Completions OpenAI. Dukungan Sumopod
belum diasumsikan; tujuan alat ini adalah mengukurnya.

Alat ini terpisah dari aplikasi dan tidak menimpa laporan kalibrasi lama.
Setelah patch usage, kontrol tetap menghapus opsi usage secara eksplisit.
File diagnostik bukan bukti untuk promosi policy.

Jalankan dari root proyek dengan Node.js 24.

Rencana tanpa jaringan atau biaya:

    node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/stream-usage-probe.mjs

Setelah cap provider dan tarif diperiksa, gunakan konfigurasi guard live yang
sama dengan evaluasi sebelumnya. Eksekusi maksimal dua panggilan, tanpa retry:

    node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/stream-usage-probe.mjs --live

Model default gpt-4o-mini. Untuk model publik lain, tambahkan --model diikuti
gpt-5.4-mini atau deepseek-v4-flash. Batas output tetap 64 token per panggilan.
Konkurensi satu. Key tetap terikat pada cap yang sama; biaya run sebelumnya
tetap mengurangi sisa cap provider. Alat tidak menaikkan atau mereset cap.

Hasil ditulis dalam folder baru evaluation/usage-probe-.../report.json.
File lama tidak ditimpa. Report hanya mencatat body probe tetap, status HTTP,
metadata usage yang diizinkan, dan hasil parser; tidak menyimpan API key,
header, raw SSE, atau private reasoning. Biaya tagihan aktual tetap unknown.

Interpretasi diagnosis:

- USAGE_CAPTURED_WITH_INCLUDE_USAGE: opsi usage menghasilkan statistik yang
  dapat dibaca parser produksi pada model yang diuji.
- USAGE_PRESENT_IN_BOTH_VARIANTS: kedua varian menghasilkan usage.
- NO_COMPLETE_USAGE_IN_EXPECTED_FIELDS: respons selesai, tetapi field usage
  yang diperlukan tidak tercatat lengkap.
- WIRE_USAGE_NOT_CAPTURED_BY_PRODUCTION_PARSER: statistik muncul di frame
  mentah yang diperiksa, tetapi tidak tertangkap parser produksi.
- INCLUDE_USAGE_REQUEST_REJECTED: varian opsi ditolak dengan HTTP 400.
- PROBE_INCOMPLETE: periksa error atau guard; hasil belum menyimpulkan dukungan.

Kirim report.json diagnostik untuk menentukan perubahan berikutnya.
Perubahan berikutnya pada pipeline/prompt memerlukan kalibrasi baru sesuai
fingerprint source; laporan kualitas lama tetap dipertahankan sebagai historis.

Tes offline lokal tanpa provider:

    node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/stream-usage-probe.test.mts

Referensi kontrak opsi:
https://platform.openai.com/docs/api-reference/chat/create
