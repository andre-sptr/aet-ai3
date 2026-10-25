# Analisis offline AET AI

Status: **CONSISTENT_OPERATOR_ARTIFACTS**. SHA-256 laporan: `782091c2b0eabe5290ad01b472a24759e4cbff3db08f9e7a85e44cb0fc5bfc03`.
Diperiksa 96 pasangan model/kasus; 87 lengkap, 9 terpotong. Legacy PASS/INCONCLUSIVE/FAIL: 63/15/18.
Lulus objektif: 78; gagal objektif lengkap: 9. Usage diketahui: 23/96. Subtotal biaya usage: USD 0.0114558; biaya total dan tagihan aktual: null.

## Dimensi terpisah (screening-dimensions-v1)

| Model | Teknis | Isi lulus/diukur | Format lulus/diukur | Terpotong | Review | Median/p95 ms (n) | Usage diketahui/attempt | Subtotal usage USD |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| gpt-4o-mini | 8/8 | 5/7 | 6/7 | 0 | 2 | 1026/2209 (8) | 8/8 | 0.00132225 |
| gpt-4.1-mini | 8/8 | 6/7 | 6/7 | 0 | 2 | 870/1468 (8) | 0/8 | null |
| gpt-5-mini | 6/8 | 6/6 | 5/5 | 2 | 0 | 3983/9253 (6) | 0/8 | null |
| gpt-5.4-mini | 8/8 | 7/7 | 7/7 | 0 | 2 | 925/1836 (8) | 8/8 | 0.00695175 |
| gpt-5.4 | 8/8 | 7/7 | 7/7 | 0 | 2 | 1775/2410 (8) | 0/8 | null |
| claude-haiku-4-5 | 8/8 | 6/7 | 6/7 | 0 | 2 | 957/2448 (8) | 0/8 | null |
| claude-sonnet-5 | 8/8 | 7/7 | 6/7 | 0 | 2 | 1191.5/4916 (8) | 0/8 | null |
| claude-opus-5 | 6/8 | 6/6 | 4/5 | 2 | 0 | 1423/2335 (6) | 0/8 | null |
| gemini/gemini-3.5-flash | 6/8 | 6/6 | 5/5 | 2 | 0 | 3693.5/6460 (6) | 0/8 | null |
| gemini/gemini-3.1-pro-preview | 7/8 | 6/6 | 6/6 | 1 | 1 | 5669/7251 (7) | 0/8 | null |
| deepseek-v4-flash | 7/8 | 6/6 | 6/6 | 1 | 1 | 1907/2934 (7) | 7/8 | 0.0031818 |
| deepseek-v4-pro | 7/8 | 6/6 | 6/6 | 1 | 1 | 3387/10191 (7) | 0/8 | null |

Isi hanya mencakup cek yang dapat diukur. Terpotong tidak dinilai salah isi. Median/p95 adalah durasi total respons lengkap, bukan TTFT; p95 nearest rank. Subtotal biaya hanya mencakup usage yang diketahui × tarif operator; tagihan dan biaya request yang tidak diketahui tetap null. Hasil ini bukan evaluasi routing aplikasi atau ranking universal.

## Pemeriksaan artefak

- PASS: unique-model-case-pairs.
- PASS: catalog-exact-ids.
- PASS: complete-matrix.
- PASS: dataset-hash.
- PASS: reproduced-request-bodies.
- PASS: historical-validator-unchanged.
- PASS: request-counter.
- PASS: completion-counter.
- PASS: recorded-token-counter.
- PASS: reservation-counter.

## Bukti aplikasi historis

- evaluation/run-2026-10-25T10-19-39-821Z-7d18ecea/report.json: gpt-4o-mini, 18 sampel, 3 pengulangan; fingerprint saat ini tidak cocok; retest diperlukan.
- evaluation/run-2026-10-25T10-26-37-433Z-9dd2855b/report.json: gpt-5.4-mini, 18 sampel, 3 pengulangan; fingerprint saat ini tidak cocok; retest diperlukan.
- evaluation/run-2026-10-25T10-30-17-107Z-7992e43f/report.json: deepseek-v4-flash, 18 sampel, 3 pengulangan; fingerprint saat ini tidak cocok; retest diperlukan.
- evaluation/run-2026-10-25T10-59-58-702Z-5a892b6d/report.json: gpt-4o-mini, 18 sampel, 3 pengulangan; fingerprint saat ini tidak cocok; retest diperlukan.
- evaluation/run-2026-10-25T11-07-16-924Z-18179459/report.json: gpt-4o-mini, 18 sampel, 3 pengulangan; fingerprint saat ini tidak cocok; retest diperlukan.
- evaluation/run-2026-10-25T11-09-42-001Z-92f79165/report.json: gpt-5.4-mini, 18 sampel, 3 pengulangan; fingerprint saat ini tidak cocok; retest diperlukan.

- Consistency verifies operator-controlled artifacts; it does not independently authenticate gateway responses or underlying model identity.
- New dimensions supplement the immutable historical rubric. Fenced JSON remains historical FAIL, while semantic content may pass the new separate check.
- Unknown historical usage reasons describe observed parser/request behavior, not evidence that trailing frames were actually sent.
- Small unequal sets of completed cases do not establish a universal speed or quality ranking.
