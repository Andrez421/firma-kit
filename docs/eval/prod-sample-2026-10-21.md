# Production signature sample — 2026-10-21

What came out of measuring the ink pipeline against **real production data** from
the `registro_asistencia` deployment, and why the non-negotiable metric still
cannot be certified.

## What production actually stores

| Folder | Files | What it is |
| --- | --- | --- |
| `uploads/signatures/` | 1 146 | the accepted, cleaned output — what the PDF prints |
| `uploads/signatures-original/` | 50 | backup taken by `scripts/reprocesar-firmas.mts` **before rewriting** those files |

The 50 originals are not a sample of all uploads: they are exactly the signatures
that needed reprocessing, i.e. old photos with grey paper, shadow, a table edge or
a grid. That is a **hard-case-enriched** subset, and it must be read as a stress
test, not as the production rejection rate.

## Measurements

### Hard-case originals (50) + synthetic (18) = 68 positives, 47 negatives

| Metric | Value |
| --- | --- |
| Confusion matrix | VP 63 · FN 5 · VN 2 · FP 45 |
| False rejections | **7.4 %** (95 % CI 3.2–16.1 %) |
| Negatives accepted by mistake | 95.7 % |
| Latency | p50 173 ms · p95 497 ms |

The five rejections are real signatures: one on dark textured paper, one on a
grid with a dark band, one rotated on a smudged grey page, one on lined paper with
a black border, one on a grid with an uneven bottom. The pipeline's answer —
"retake it on white paper" — is defensible, but it *is* a rejection of a real
signature, and it is exactly the population the ≤ 2 % metric is about.

### Idempotence on 60 processed signatures, sampled at random

**60 of 60 accepted.** The pipeline does not reject its own output, so the
rejections above are about the input quality, not about re-cleaning.

## The structural finding

A post-hoc false-rejection rate cannot be measured for this system: the inputs are
not kept. 1 146 outputs exist, 50 inputs survive, and those 50 are the hard cases.

Consequences:

1. **The ≤ 2 % metric cannot be certified from stored data.** It has to be
   measured where the input exists: at upload time, instrumented in production
   (count `{accepted, rejected, reason}` per attempt), or by keeping originals
   under a retention policy and with the person's consent.
2. **`firma-kit` should ship that choice.** A "keep the original for evaluation"
   option in the consuming app, off by default, is the difference between being
   able to calibrate the gate later and guessing.
3. **With 68 positives, even zero rejections would not prove ≤ 2 %** (the 95 %
   upper bound would be ~4 %). The conservative bound is 3/N: 150 positives.

## Data handling

The 50 originals were copied to a local, unversioned volume for this measurement
and are marked `sensitive: true` in the corpus manifest. They are personal data
from production: the retention decision belongs to the owner, and they must not be
published, shared, or committed.
