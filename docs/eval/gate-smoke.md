# Gate (MobileCLIP-S0 int8) — first measurement, 2026-10-22

Reproducible from the repository:

```bash
export FIRMA_KIT_MODULES_DIR=~/firma-kit-modules   # after `firma-kit-verify models pull`
export FIRMA_KIT_EVAL_CORPUS=~/corpus-firma-kit
pnpm --filter @firma-kit/eval eval -- --gate --licensed-only
```

## What was measured

65 images with known licence: 18 generated signatures (positives) and 47 negatives
(19 own phone photos + 28 generated document layouts).

| Metric | Gate | Ink pipeline baseline, same set |
| --- | --- | --- |
| True positives | 2 | 18 |
| False negatives | 16 | 0 |
| True negatives | 47 | 2 |
| False positives | 0 | 45 |
| **False rejections** | **88.9 %** (95 % CI 67.2–96.9 %) | 0.0 % |
| **Negatives accepted by mistake** | **0.0 %** (95 % CI 0.0–7.6 %) | 95.7 % |
| Latency | p50 518 ms · p95 783 ms | p50 173 ms |
| Model load | ~1.1 s | — |

## What it says

1. **The gate does what the gate is for.** It rejected every negative — identity
   cards, invoices, forms, screenshots, objects, people, scribbles — where the ink
   pipeline accepted 95.7 % of them. Cleaning ink and deciding "this is a
   signature" are different problems, and this is the second one.
2. **The false-rejection number is not about real signatures.** The 18 positives
   are **vector drawings** produced by `rasterizeStroke`: a black curve on white
   with no paper, no shadow, no texture. A zero-shot photo classifier is not
   expected to call a vector squiggle "a handwritten signature on paper", and 2/18
   is consistent with that, not with the gate failing on real people's signatures.
3. **Therefore this file does not calibrate anything.** No threshold moves on this
   evidence. What it establishes is that the gate is worth calibrating and that the
   harness can measure both tiers the same way.

## What would close the question

Three to five photos of a **real handwritten signature** — the owner's own
handwriting on paper, taken with a phone, kept local. That is the only missing
piece: with real positives the false-rejection rate becomes measurable, and only
then can `gateAccept` / `gateReject` in `src/thresholds.ts` be set with evidence.

Until then the thresholds stay at their provisional values, and the report keeps
printing how many positives would be needed to claim a 2 % ceiling (3/N: 150).
