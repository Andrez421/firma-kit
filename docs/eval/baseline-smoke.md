# Baseline smoke test — 2026-10-21

**This is not calibration.** It is a smoke test of the evaluation harness on a
mixed corpus, with the ink pipeline acting as the verifier. The numbers below do
**not** fix any threshold: 82 of the negative images have unverified licences
(`web-unverified`), and the harness itself reports `evidence: no`.

Reproduce with:

```bash
export FIRMA_KIT_EVAL_CORPUS=/path/to/corpus
pnpm --filter @firma-kit/eval eval -- --baseline
```

## Corpus

| Group | Count | Provenance |
| --- | --- | --- |
| Positives, synthetic | 18 | generated with `rasterizeStroke`, deterministic seed |
| Positives, real | 24 | `registro_asistencia` local uploads, marked sensitive |
| Negatives, own photos | 19 | phone photos over WhatsApp, class-labelled |
| Negatives, web | 82 | web downloads, licence unknown (`web-unverified`) |
| **Total** | **143** | 62 marked sensitive |

Negatives cover: identity documents (19), invoices and receipts (20), forms (13),
screenshots and photographed screens (12), paper and scribbles (12), objects (10),
people and hands (8), old handwritten documents (7). Three contain a real
signature **inside** a document, which is the adversarial case the gate must get
right.

## Result (verifier: ink pipeline baseline)

| Metric | Value |
| --- | --- |
| Confusion matrix | VP 42 · FN 0 · VN 7 · FP 94 |
| False rejections (on signatures) | **0.0 %** |
| False accepts (on negatives) | **6.9 %** |
| Latency | p50 45 ms · p95 379 ms · max 800 ms |

Accepted as a signature, by negative class: identity documents 19/19, invoices and
receipts 19/20, forms 13/13, screenshots and screens 10/12, paper and scribbles
11/12, objects 8/10, people and hands 8/8, handwritten documents 6/7.

## What it says

1. **The ink pipeline is not a signature detector, and never claimed to be.** It
   accepts 94 of 101 negatives because a dark document *is* ink: cleaning the
   background and deciding "this is a signature" are different questions. This is
   the measurement that justifies the phase-3 gate.
2. **Zero false rejections on 42 positives** (18 synthetic + 24 real) is the
   number that must stay low: the metric that is not negotiable holds on this
   sample.
3. **The harness works end to end**: manifest validation, decoding, per-class
   failures, latency percentiles, the budget gate and the `evidence` flag, over
   real files rather than mocks.

## What it does not say

Nothing about the two-tier verifier, which has no weights yet, and nothing usable
for thresholds: this corpus is not licensed, the positives include synthetic
drawings, and 101 negatives is a smoke-test size. Calibration still needs 30–50
real, licensed negatives and the pinned model hashes.
