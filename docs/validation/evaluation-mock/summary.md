# Evaluasi AETAI

Jenis bukti: **LOCAL_MOCK**. Status: **HAS_FAILURES**. Generasi: 126. Pengulangan: 3.

| Varian | Sampel objektif | Lulus | Error | p50 ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| baseline | 27 | 0.8888888888888888 | 0 | 1 | 1 |
| fast | 27 | 1 | 0 | 1 | 8 |
| normal | 27 | 1 | 0 | 1 | 9 |
| think | 27 | 1 | 0 | 1 | 9 |

Biaya tagihan aktual: unknown. Usage yang hilang tetap null. Estimasi tidak membuktikan cap provider.

- Mock results only test software flow; they do not measure AI quality, provider latency or billing.
- Baseline reproduces the former single-model 40-message context path; this is service-level evaluation, not an old deployed HTTP endpoint.
- Objective checks measure only specified constraints. Relevance, factual entailment, language quality and broader code correctness require blinded human review.
- No optional generation parameters or native tools are probed. Metadata availability is not a capability test.
- No external model voting or confidence score proves truth.
- Run at least three repeats with identical cases and review failures/trade-offs before promoting routing.

Unggah report.json dan review.csv yang telah diisi untuk analisis lanjutan.