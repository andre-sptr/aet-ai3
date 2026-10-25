# Evaluasi 12 model AET AI

Waktu: 2026-10-25T11:17:41.534Z. Status keseluruhan: **FAIL**.

Rencana 96 sel: 36 persona, 36 reasoning, 12 konteks dan 12 smoke streaming. Sel tidak dijalankan tetap dicatat BLOCKED; bukan sampel model.

| Model | Daily | Report | Coding | Reasoning (3) | Konteks | Stream |
| --- | --- | --- | --- | --- | --- | --- |
| gpt-4o-mini | INCONCLUSIVE | INCONCLUSIVE | PASS | FAIL | PASS | PASS |
| gpt-4.1-mini | INCONCLUSIVE | INCONCLUSIVE | PASS | FAIL/PASS | PASS | PASS |
| gpt-5-mini | FAIL | FAIL | PASS | PASS | PASS | PASS |
| gpt-5.4-mini | INCONCLUSIVE | INCONCLUSIVE | PASS | PASS | PASS | PASS |
| gpt-5.4 | INCONCLUSIVE | INCONCLUSIVE | PASS | PASS | PASS | PASS |
| claude-haiku-4-5 | INCONCLUSIVE | INCONCLUSIVE | PASS | FAIL/PASS | PASS | PASS |
| claude-sonnet-5 | INCONCLUSIVE | INCONCLUSIVE | PASS | PASS/FAIL | PASS | PASS |
| claude-opus-5 | FAIL | FAIL | PASS | PASS/FAIL | PASS | PASS |
| gemini/gemini-3.5-flash | FAIL | FAIL | PASS | PASS | PASS | PASS |
| gemini/gemini-3.1-pro-preview | INCONCLUSIVE | FAIL | PASS | PASS | PASS | PASS |
| deepseek-v4-flash | INCONCLUSIVE | FAIL | PASS | PASS | PASS | PASS |
| deepseek-v4-pro | INCONCLUSIVE | FAIL | PASS | PASS | PASS | PASS |

Jenis bukti: **live**. Request generasi: 96; selesai secara teknis: 87; request metadata: 1; token yang benar-benar dilaporkan: 24435; biaya USD aktual: **tidak diketahui**.

Metadata bersifat advisory: HTTP 200. Metadata gagal atau ID tidak tercantum tidak menggagalkan direct POST yang sudah memenuhi semua guard.

Guard cap provider: tercatat (attestasi operator). 

Tarif resmi terverifikasi: tercatat (attestasi operator). 

Batas lokal estimasi: 2.4000000000000004 USD; cadangan provider 20%; request terjadwal dalam gelombang lengkap: 96. Estimasi bukan tagihan aktual atau jaminan tokenizer.

## Hasil per kasus

| Model | Kasus | Status | HTTP | Finish | Latency ms | Usage | Alasan |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-4o-mini | stream-smoke | PASS | 200 | stop | 805 | 849 |  |
| gpt-4.1-mini | stream-smoke | PASS | 200 | stop | 802 | — |  |
| gpt-5-mini | stream-smoke | PASS | 200 | stop | 4647 | — |  |
| gpt-5.4-mini | stream-smoke | PASS | 200 | stop | 986 | 824 |  |
| gpt-5.4 | stream-smoke | PASS | 200 | stop | 1280 | — |  |
| claude-haiku-4-5 | stream-smoke | PASS | 200 | stop | 1088 | — |  |
| claude-sonnet-5 | stream-smoke | PASS | 200 | stop | 1176 | — |  |
| claude-opus-5 | stream-smoke | PASS | 200 | stop | 1370 | — |  |
| gemini/gemini-3.5-flash | stream-smoke | PASS | 200 | stop | 2431 | — |  |
| gemini/gemini-3.1-pro-preview | stream-smoke | PASS | 200 | stop | 3283 | — |  |
| deepseek-v4-flash | stream-smoke | PASS | 200 | stop | 2196 | 968 |  |
| deepseek-v4-pro | stream-smoke | PASS | 200 | stop | 1843 | — |  |
| gpt-4o-mini | persona-daily | INCONCLUSIVE | 200 | stop | 1283 | 938 | Objective constraints recorded; qualitative persona review still required. |
| gpt-4.1-mini | persona-daily | INCONCLUSIVE | 200 | stop | 929 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-5-mini | persona-daily | FAIL | 200 | length | 5879 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gpt-5.4-mini | persona-daily | INCONCLUSIVE | 200 | stop | 1114 | 936 | Objective constraints recorded; qualitative persona review still required. |
| gpt-5.4 | persona-daily | INCONCLUSIVE | 200 | stop | 2410 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-haiku-4-5 | persona-daily | INCONCLUSIVE | 200 | stop | 1739 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-sonnet-5 | persona-daily | INCONCLUSIVE | 200 | stop | 3000 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-opus-5 | persona-daily | FAIL | 200 | length | 8342 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gemini/gemini-3.5-flash | persona-daily | FAIL | 200 | length | 7312 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gemini/gemini-3.1-pro-preview | persona-daily | INCONCLUSIVE | 200 | stop | 7251 | — | Objective constraints recorded; qualitative persona review still required. |
| deepseek-v4-flash | persona-daily | INCONCLUSIVE | 200 | stop | 2934 | 1355 | Objective constraints recorded; qualitative persona review still required. |
| deepseek-v4-pro | persona-daily | INCONCLUSIVE | 200 | stop | 10191 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-4o-mini | persona-report | INCONCLUSIVE | 200 | stop | 2209 | 1318 | Objective constraints recorded; qualitative persona review still required. |
| gpt-4.1-mini | persona-report | INCONCLUSIVE | 200 | stop | 1468 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-5-mini | persona-report | FAIL | 200 | length | 11807 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gpt-5.4-mini | persona-report | INCONCLUSIVE | 200 | stop | 1726 | 1287 | Objective constraints recorded; qualitative persona review still required. |
| gpt-5.4 | persona-report | INCONCLUSIVE | 200 | stop | 2181 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-haiku-4-5 | persona-report | INCONCLUSIVE | 200 | stop | 2448 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-sonnet-5 | persona-report | INCONCLUSIVE | 200 | stop | 4916 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-opus-5 | persona-report | FAIL | 200 | length | 7340 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gemini/gemini-3.5-flash | persona-report | FAIL | 200 | length | 7127 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gemini/gemini-3.1-pro-preview | persona-report | FAIL | 200 | length | 8546 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| deepseek-v4-flash | persona-report | FAIL | 200 | length | 4420 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| deepseek-v4-pro | persona-report | FAIL | 200 | length | 8962 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gpt-4o-mini | persona-coding | PASS | 200 | stop | 1030 | 1057 |  |
| gpt-4.1-mini | persona-coding | PASS | 200 | stop | 795 | — |  |
| gpt-5-mini | persona-coding | PASS | 200 | stop | 6061 | — |  |
| gpt-5.4-mini | persona-coding | PASS | 200 | stop | 1836 | 1032 |  |
| gpt-5.4 | persona-coding | PASS | 200 | stop | 1369 | — |  |
| claude-haiku-4-5 | persona-coding | PASS | 200 | stop | 897 | — |  |
| claude-sonnet-5 | persona-coding | PASS | 200 | stop | 1013 | — |  |
| claude-opus-5 | persona-coding | PASS | 200 | stop | 1638 | — |  |
| gemini/gemini-3.5-flash | persona-coding | PASS | 200 | stop | 6460 | — |  |
| gemini/gemini-3.1-pro-preview | persona-coding | PASS | 200 | stop | 6146 | — |  |
| deepseek-v4-flash | persona-coding | PASS | 200 | stop | 1907 | 1269 |  |
| deepseek-v4-pro | persona-coding | PASS | 200 | stop | 3917 | — |  |
| gpt-4o-mini | reasoning-quantitative | FAIL | 200 | stop | 881 | 913 |  |
| gpt-4.1-mini | reasoning-quantitative | FAIL | 200 | stop | 895 | — |  |
| gpt-5-mini | reasoning-quantitative | PASS | 200 | stop | 3289 | — |  |
| gpt-5.4-mini | reasoning-quantitative | PASS | 200 | stop | 705 | 888 |  |
| gpt-5.4 | reasoning-quantitative | PASS | 200 | stop | 2258 | — |  |
| claude-haiku-4-5 | reasoning-quantitative | FAIL | 200 | stop | 856 | — |  |
| claude-sonnet-5 | reasoning-quantitative | PASS | 200 | stop | 1127 | — |  |
| claude-opus-5 | reasoning-quantitative | PASS | 200 | stop | 1236 | — |  |
| gemini/gemini-3.5-flash | reasoning-quantitative | PASS | 200 | stop | 3292 | — |  |
| gemini/gemini-3.1-pro-preview | reasoning-quantitative | PASS | 200 | stop | 4167 | — |  |
| deepseek-v4-flash | reasoning-quantitative | PASS | 200 | stop | 1504 | 1085 |  |
| deepseek-v4-pro | reasoning-quantitative | PASS | 200 | stop | 3234 | — |  |
| gpt-4o-mini | reasoning-constraints | FAIL | 200 | stop | 1177 | 920 |  |
| gpt-4.1-mini | reasoning-constraints | PASS | 200 | stop | 1117 | — |  |
| gpt-5-mini | reasoning-constraints | PASS | 200 | stop | 9253 | — |  |
| gpt-5.4-mini | reasoning-constraints | PASS | 200 | stop | 851 | 901 |  |
| gpt-5.4 | reasoning-constraints | PASS | 200 | stop | 2389 | — |  |
| claude-haiku-4-5 | reasoning-constraints | PASS | 200 | stop | 981 | — |  |
| claude-sonnet-5 | reasoning-constraints | PASS | 200 | stop | 3440 | — |  |
| claude-opus-5 | reasoning-constraints | PASS | 200 | stop | 2335 | — |  |
| gemini/gemini-3.5-flash | reasoning-constraints | PASS | 200 | stop | 4095 | — |  |
| gemini/gemini-3.1-pro-preview | reasoning-constraints | PASS | 200 | stop | 5669 | — |  |
| deepseek-v4-flash | reasoning-constraints | PASS | 200 | stop | 1856 | 1172 |  |
| deepseek-v4-pro | reasoning-constraints | PASS | 200 | stop | 5146 | — |  |
| gpt-4o-mini | reasoning-conflicting-information | FAIL | 200 | stop | 1022 | 1215 |  |
| gpt-4.1-mini | reasoning-conflicting-information | FAIL | 200 | stop | 845 | — |  |
| gpt-5-mini | reasoning-conflicting-information | PASS | 200 | stop | 3319 | — |  |
| gpt-5.4-mini | reasoning-conflicting-information | PASS | 200 | stop | 864 | 1180 |  |
| gpt-5.4 | reasoning-conflicting-information | PASS | 200 | stop | 1335 | — |  |
| claude-haiku-4-5 | reasoning-conflicting-information | FAIL | 200 | stop | 933 | — |  |
| claude-sonnet-5 | reasoning-conflicting-information | FAIL | 200 | stop | 1207 | — |  |
| claude-opus-5 | reasoning-conflicting-information | FAIL | 200 | stop | 1476 | — |  |
| gemini/gemini-3.5-flash | reasoning-conflicting-information | PASS | 200 | stop | 5228 | — |  |
| gemini/gemini-3.1-pro-preview | reasoning-conflicting-information | PASS | 200 | stop | 6483 | — |  |
| deepseek-v4-flash | reasoning-conflicting-information | PASS | 200 | stop | 2749 | 1453 |  |
| deepseek-v4-pro | reasoning-conflicting-information | PASS | 200 | stop | 3387 | — |  |
| gpt-4o-mini | context-latest-correction | PASS | 200 | stop | 862 | 927 |  |
| gpt-4.1-mini | context-latest-correction | PASS | 200 | stop | 714 | — |  |
| gpt-5-mini | context-latest-correction | PASS | 200 | stop | 2375 | — |  |
| gpt-5.4-mini | context-latest-correction | PASS | 200 | stop | 724 | 906 |  |
| gpt-5.4 | context-latest-correction | PASS | 200 | stop | 1203 | — |  |
| claude-haiku-4-5 | context-latest-correction | PASS | 200 | stop | 893 | — |  |
| claude-sonnet-5 | context-latest-correction | PASS | 200 | stop | 1010 | — |  |
| claude-opus-5 | context-latest-correction | PASS | 200 | stop | 1340 | — |  |
| gemini/gemini-3.5-flash | context-latest-correction | PASS | 200 | stop | 2449 | — |  |
| gemini/gemini-3.1-pro-preview | context-latest-correction | PASS | 200 | stop | 3687 | — |  |
| deepseek-v4-flash | context-latest-correction | PASS | 200 | stop | 1226 | 1042 |  |
| deepseek-v4-pro | context-latest-correction | PASS | 200 | stop | 2961 | — |  |

## Rubrik 0–5 dan cakupan skor

Bobot: akurasi 25%, penalaran/kendala 20%, konsistensi konteks 15%, persona/instruksi 15%, integritas fakta 10%, streaming/integrasi 5%, latensi/biaya 10%. Skor parsial mencatat cakupan bobot; dimensi tidak teramati tetap null. Skor dengan cakupan berbeda tidak dibandingkan sebagai peringkat. Kepatuhan format dicatat terpisah dan tidak menggantikan review persona.

0 = salah/tidak memenuhi; 1 = sebagian besar salah; 2 = kekurangan besar; 3 = memadai dengan kekurangan berarti; 4 = kuat dengan kekurangan kecil; 5 = seluruh kriteria yang dinilai terpenuhi. Validator deterministik memberikan 0/5 hanya untuk hasil/format yang dapat dibuktikan. Dimensi kualitatif tidak ditebak dari kata kunci dan tetap null sampai review tercatat.

Semua skor per kasus dan dimensi disimpan di report.json. Skor null berarti tidak dinilai, bukan nol. Jawaban akhir dan penjelasan singkat dinilai tanpa meminta/menyimpan hidden chain-of-thought. Tidak ada model judge berbayar.

## Rekomendasi dan keterbatasan

Belum ada rekomendasi pemenang antar-model tanpa respons baru dan review kualitatif. Default aplikasi tetap gpt-4o-mini sesuai konfigurasi awal, bukan hasil kemenangan benchmark ini. Satu kasus per persona dan per jenis tugas hanya screening; hasil PASS objektif tidak membuktikan keunggulan umum persona.

Prompt dibuat melalui buildSystemPrompt produksi; parameter melalui buildSumopodChatRequest; katalog dibaca dari AI_MODELS. Frontier tidak diaktifkan pada endpoint aplikasi; harness operator menguji gateway langsung hanya setelah guard biaya terpenuhi. Tidak ada native tools, parameter reasoning, vision baru, retry otomatis, fallback, atau biaya yang diperkirakan tanpa tarif terverifikasi.

Budget guard berhenti sebelum generasi tanpa bukti cap provider pada key khusus. AET_TEST_BUDGET_USD saja tidak mengukur atau menghentikan tagihan. Attestasi operator terhadap cap provider dicatat terpisah dari verifikasi API otomatis.
