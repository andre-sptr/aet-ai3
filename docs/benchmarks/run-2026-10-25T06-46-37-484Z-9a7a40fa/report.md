# Evaluasi 12 model AET AI

Waktu: 2026-10-25T06:46:37.484Z. Status keseluruhan: **INCONCLUSIVE**.

Rencana 96 sel: 36 persona, 36 reasoning, 12 konteks dan 12 smoke streaming. Sel tidak dijalankan tetap dicatat BLOCKED; bukan sampel model.

| Model | Daily | Report | Coding | Reasoning (3) | Konteks | Stream |
| --- | --- | --- | --- | --- | --- | --- |
| gpt-4o-mini | INCONCLUSIVE | INCONCLUSIVE | PASS | FAIL/BLOCKED | BLOCKED | PASS |
| gpt-4.1-mini | INCONCLUSIVE | INCONCLUSIVE | PASS | FAIL/BLOCKED | BLOCKED | PASS |
| gpt-5-mini | FAIL | FAIL | PASS | PASS/BLOCKED | BLOCKED | PASS |
| gpt-5.4-mini | INCONCLUSIVE | INCONCLUSIVE | PASS | PASS/BLOCKED | BLOCKED | PASS |
| gpt-5.4 | INCONCLUSIVE | INCONCLUSIVE | PASS | PASS/BLOCKED | BLOCKED | PASS |
| claude-haiku-4-5 | INCONCLUSIVE | INCONCLUSIVE | PASS | FAIL/BLOCKED | BLOCKED | PASS |
| claude-sonnet-5 | INCONCLUSIVE | INCONCLUSIVE | PASS | PASS/BLOCKED | BLOCKED | PASS |
| claude-opus-5 | INCONCLUSIVE | FAIL | PASS | PASS/BLOCKED | BLOCKED | PASS |
| gemini/gemini-3.5-flash | INCONCLUSIVE | FAIL | PASS | PASS/BLOCKED | BLOCKED | PASS |
| gemini/gemini-3.1-pro-preview | FAIL | FAIL | PASS | PASS/BLOCKED | BLOCKED | PASS |
| deepseek-v4-flash | INCONCLUSIVE | FAIL | PASS | PASS/BLOCKED | BLOCKED | PASS |
| deepseek-v4-pro | FAIL | FAIL | PASS | PASS/BLOCKED | BLOCKED | PASS |

Jenis bukti: **live**. Request generasi: 60; selesai secara teknis: 51; request metadata: 1; token yang benar-benar dilaporkan: 0; biaya USD aktual: **tidak diketahui**.

Metadata bersifat advisory: HTTP 200. Metadata gagal atau ID tidak tercantum tidak menggagalkan direct POST yang sudah memenuhi semua guard.

Guard cap provider: tercatat (attestasi operator). 

Tarif resmi terverifikasi: tercatat (attestasi operator). 

Batas lokal estimasi: 2.4000000000000004 USD; cadangan provider 20%; request terjadwal dalam gelombang lengkap: 96. Estimasi bukan tagihan aktual atau jaminan tokenizer.

## Hasil per kasus

| Model | Kasus | Status | HTTP | Finish | Latency ms | Usage | Alasan |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-4o-mini | stream-smoke | PASS | 200 | stop | 925 | — |  |
| gpt-4.1-mini | stream-smoke | PASS | 200 | stop | 757 | — |  |
| gpt-5-mini | stream-smoke | PASS | 200 | stop | 2655 | — |  |
| gpt-5.4-mini | stream-smoke | PASS | 200 | stop | 746 | — |  |
| gpt-5.4 | stream-smoke | PASS | 200 | stop | 953 | — |  |
| claude-haiku-4-5 | stream-smoke | PASS | 200 | stop | 822 | — |  |
| claude-sonnet-5 | stream-smoke | PASS | 200 | stop | 981 | — |  |
| claude-opus-5 | stream-smoke | PASS | 200 | stop | 1180 | — |  |
| gemini/gemini-3.5-flash | stream-smoke | PASS | 200 | stop | 2125 | — |  |
| gemini/gemini-3.1-pro-preview | stream-smoke | PASS | 200 | stop | 3506 | — |  |
| deepseek-v4-flash | stream-smoke | PASS | 200 | stop | 1067 | — |  |
| deepseek-v4-pro | stream-smoke | PASS | 200 | stop | 5145 | — |  |
| gpt-4o-mini | persona-daily | INCONCLUSIVE | 200 | stop | 2123 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-4.1-mini | persona-daily | INCONCLUSIVE | 200 | stop | 1056 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-5-mini | persona-daily | FAIL | 200 | length | 5704 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gpt-5.4-mini | persona-daily | INCONCLUSIVE | 200 | stop | 1232 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-5.4 | persona-daily | INCONCLUSIVE | 200 | stop | 3644 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-haiku-4-5 | persona-daily | INCONCLUSIVE | 200 | stop | 1855 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-sonnet-5 | persona-daily | INCONCLUSIVE | 200 | stop | 2476 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-opus-5 | persona-daily | INCONCLUSIVE | 200 | stop | 2171 | — | Objective constraints recorded; qualitative persona review still required. |
| gemini/gemini-3.5-flash | persona-daily | INCONCLUSIVE | 200 | stop | 6516 | — | Objective constraints recorded; qualitative persona review still required. |
| gemini/gemini-3.1-pro-preview | persona-daily | FAIL | 200 | length | 8818 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| deepseek-v4-flash | persona-daily | INCONCLUSIVE | 200 | stop | 7251 | — | Objective constraints recorded; qualitative persona review still required. |
| deepseek-v4-pro | persona-daily | FAIL | 200 | length | 8562 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gpt-4o-mini | persona-report | INCONCLUSIVE | 200 | stop | 2821 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-4.1-mini | persona-report | INCONCLUSIVE | 200 | stop | 1369 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-5-mini | persona-report | FAIL | 200 | length | 5502 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gpt-5.4-mini | persona-report | INCONCLUSIVE | 200 | stop | 1222 | — | Objective constraints recorded; qualitative persona review still required. |
| gpt-5.4 | persona-report | INCONCLUSIVE | 200 | stop | 1643 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-haiku-4-5 | persona-report | INCONCLUSIVE | 200 | stop | 2558 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-sonnet-5 | persona-report | INCONCLUSIVE | 200 | stop | 3326 | — | Objective constraints recorded; qualitative persona review still required. |
| claude-opus-5 | persona-report | FAIL | 200 | length | 6529 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gemini/gemini-3.5-flash | persona-report | FAIL | 200 | length | 5803 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gemini/gemini-3.1-pro-preview | persona-report | FAIL | 200 | length | 8234 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| deepseek-v4-flash | persona-report | FAIL | 200 | length | 4206 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| deepseek-v4-pro | persona-report | FAIL | 200 | length | 10008 | — | Batas keluaran model tercapai. Minta jawaban lebih singkat atau lanjutkan. |
| gpt-4o-mini | persona-coding | PASS | 200 | stop | 1021 | — |  |
| gpt-4.1-mini | persona-coding | PASS | 200 | stop | 769 | — |  |
| gpt-5-mini | persona-coding | PASS | 200 | stop | 2969 | — |  |
| gpt-5.4-mini | persona-coding | PASS | 200 | stop | 1299 | — |  |
| gpt-5.4 | persona-coding | PASS | 200 | stop | 943 | — |  |
| claude-haiku-4-5 | persona-coding | PASS | 200 | stop | 904 | — |  |
| claude-sonnet-5 | persona-coding | PASS | 200 | stop | 2098 | — |  |
| claude-opus-5 | persona-coding | PASS | 200 | stop | 1569 | — |  |
| gemini/gemini-3.5-flash | persona-coding | PASS | 200 | stop | 5448 | — |  |
| gemini/gemini-3.1-pro-preview | persona-coding | PASS | 200 | stop | 6189 | — |  |
| deepseek-v4-flash | persona-coding | PASS | 200 | stop | 1931 | — |  |
| deepseek-v4-pro | persona-coding | PASS | 200 | stop | 7496 | — |  |
| gpt-4o-mini | reasoning-quantitative | FAIL | 200 | stop | 3655 | — |  |
| gpt-4.1-mini | reasoning-quantitative | FAIL | 200 | stop | 708 | — |  |
| gpt-5-mini | reasoning-quantitative | PASS | 200 | stop | 4186 | — |  |
| gpt-5.4-mini | reasoning-quantitative | PASS | 200 | stop | 915 | — |  |
| gpt-5.4 | reasoning-quantitative | PASS | 200 | stop | 1092 | — |  |
| claude-haiku-4-5 | reasoning-quantitative | FAIL | 200 | stop | 805 | — |  |
| claude-sonnet-5 | reasoning-quantitative | PASS | 200 | stop | 1495 | — |  |
| claude-opus-5 | reasoning-quantitative | PASS | 200 | stop | 1289 | — |  |
| gemini/gemini-3.5-flash | reasoning-quantitative | PASS | 200 | stop | 3351 | — |  |
| gemini/gemini-3.1-pro-preview | reasoning-quantitative | PASS | 200 | stop | 3799 | — |  |
| deepseek-v4-flash | reasoning-quantitative | PASS | 200 | stop | 1271 | — |  |
| deepseek-v4-pro | reasoning-quantitative | PASS | 200 | stop | 3373 | — |  |
| gpt-4o-mini | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-4.1-mini | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5-mini | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5.4-mini | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5.4 | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-haiku-4-5 | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-sonnet-5 | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-opus-5 | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| gemini/gemini-3.5-flash | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| gemini/gemini-3.1-pro-preview | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| deepseek-v4-flash | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| deepseek-v4-pro | reasoning-constraints | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-4o-mini | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-4.1-mini | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5-mini | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5.4-mini | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5.4 | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-haiku-4-5 | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-sonnet-5 | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-opus-5 | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| gemini/gemini-3.5-flash | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| gemini/gemini-3.1-pro-preview | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| deepseek-v4-flash | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| deepseek-v4-pro | reasoning-conflicting-information | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-4o-mini | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-4.1-mini | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5-mini | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5.4-mini | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| gpt-5.4 | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-haiku-4-5 | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-sonnet-5 | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| claude-opus-5 | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| gemini/gemini-3.5-flash | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| gemini/gemini-3.1-pro-preview | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| deepseek-v4-flash | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |
| deepseek-v4-pro | context-latest-correction | BLOCKED | — | — | — | — | Not attempted yet. |

## Rubrik 0–5 dan cakupan skor

Bobot: akurasi 25%, penalaran/kendala 20%, konsistensi konteks 15%, persona/instruksi 15%, integritas fakta 10%, streaming/integrasi 5%, latensi/biaya 10%. Skor parsial mencatat cakupan bobot; dimensi tidak teramati tetap null. Skor dengan cakupan berbeda tidak dibandingkan sebagai peringkat. Kepatuhan format dicatat terpisah dan tidak menggantikan review persona.

0 = salah/tidak memenuhi; 1 = sebagian besar salah; 2 = kekurangan besar; 3 = memadai dengan kekurangan berarti; 4 = kuat dengan kekurangan kecil; 5 = seluruh kriteria yang dinilai terpenuhi. Validator deterministik memberikan 0/5 hanya untuk hasil/format yang dapat dibuktikan. Dimensi kualitatif tidak ditebak dari kata kunci dan tetap null sampai review tercatat.

Semua skor per kasus dan dimensi disimpan di report.json. Skor null berarti tidak dinilai, bukan nol. Jawaban akhir dan penjelasan singkat dinilai tanpa meminta/menyimpan hidden chain-of-thought. Tidak ada model judge berbayar.

## Rekomendasi dan keterbatasan

Belum ada rekomendasi pemenang antar-model tanpa respons baru dan review kualitatif. Default aplikasi tetap gpt-4o-mini sesuai konfigurasi awal, bukan hasil kemenangan benchmark ini. Satu kasus per persona dan per jenis tugas hanya screening; hasil PASS objektif tidak membuktikan keunggulan umum persona.

Prompt dibuat melalui buildSystemPrompt produksi; parameter melalui buildSumopodChatRequest; katalog dibaca dari AI_MODELS. Frontier tidak diaktifkan pada endpoint aplikasi; harness operator menguji gateway langsung hanya setelah guard biaya terpenuhi. Tidak ada native tools, parameter reasoning, vision baru, retry otomatis, fallback, atau biaya yang diperkirakan tanpa tarif terverifikasi.

Budget guard berhenti sebelum generasi tanpa bukti cap provider pada key khusus. AET_TEST_BUDGET_USD saja tidak mengukur atau menghentikan tagihan. Attestasi operator terhadap cap provider dicatat terpisah dari verifikasi API otomatis.
