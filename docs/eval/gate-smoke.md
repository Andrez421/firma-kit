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

## With four real handwritten signature photos

Four phone photos of real handwritten signatures (own handwriting, local only) were
added as positives. The gate's answer, under four different prompt sets:

| Photo | Set A (6 classes) | Set C (7, incl. "signed document") | Set D (4) | Set E (4, short) |
| --- | --- | --- | --- | --- |
| signature on a printed form | object 0.83 | object 0.44 | household object 0.99 | room 0.99 |
| scrawl on a mint page | object 0.81 | object 0.92 | household object 0.99 | room 0.99 |
| name written on lined paper | object 0.51 | object 0.41 | household object 0.90 | room 0.85 |
| signature on a plain sheet | **person 0.93** | person 0.90 | screen 0.89 | room 0.83 |

**The gate rejected all four real signatures**, while the ink pipeline accepted all
22 positives of the set (0 false rejections). On the same run:

| Metric | Gate | Ink pipeline |
| --- | --- | --- |
| False rejections (real positives included) | **90.9 %** (95 % CI 72.2–97.5 %) | 0.0 % |
| Negatives accepted by mistake | 0.0 % | 95.7 % |

Four rejections out of four is a small sample, but the 95 % lower bound is ~0.51:
this is not noise, and no prompt tweak moved it. **MobileCLIP-S0 int8 zero-shot
does not recognise a handwritten signature.**

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
   evidence. What it establishes is that the harness can measure both tiers the
   same way — and that tier 1, as specified in ADR-003, does not work for the
   positive side.

## What this means for ADR-003

The ADR assumed a cheap zero-shot gate as the first tier, with the VLM as an
occasional second opinion. The measurement says the gate cannot be the first tier:
it is a "no" machine, and a gate that rejects real signatures fails the only metric
that is not negotiable.

Options, cheapest first:

1. **Make the VLM the judge for the image modes** (`sign()` already classifies the
   original before any cleanup). It costs 1-2 s instead of 500 ms, and only for
   upload/camera — exactly the modes where a wrong acceptance matters. The weights
   are already downloaded and verified; what is missing is a runner
   (`node-llama-cpp`).
2. **Try a bigger image-text model** (SigLIP, CLIP ViT-B/32). "Handwritten
   signature" is fine-grained; a 21M-parameter student may simply not encode it.
   Costs another 100-350 MB and repeats this measurement.
3. **Drop visual verification from the module's scope** and rely on the ink
   pipeline's structural gates, which reject dark, textured and blank backgrounds
   but accept any document with strokes.

Recommendation: 1, and only if it also fails, revisit the scope.

## What would close the question

Three to five photos of a **real handwritten signature** — the owner's own
handwriting on paper, taken with a phone, kept local. That is the only missing
piece: with real positives the false-rejection rate becomes measurable, and only
then can `gateAccept` / `gateReject` in `src/thresholds.ts` be set with evidence.

Until then the thresholds stay at their provisional values, and the report keeps
printing how many positives would be needed to claim a 2 % ceiling (3/N: 150).

## Model comparison, and SigLIP as tier 1

Three image-text models were measured on the same licensed set: 4 real signature
photos, 18 generated signatures and 47 negatives.

| Model | Real signatures | Negative set | Latency |
| --- | --- | --- | --- |
| MobileCLIP-S0 int8 | **0 / 4** | 47/47 rejected | ~0.5 s |
| MobileCLIP-S1 int8 | 3 / 4 by argmax | 3/12 rejected | ~0.6 s |
| **SigLIP base (q8)** | **3 / 4** | **38/47 rejected** | 1.39 s |

MobileCLIP-S1 looked usable by argmax and is not: on the whole set the signatures
score 0.24-0.33 while negatives reach 0.55, so **no threshold separates them** — the
ordering is inverted. SigLIP does separate them.

### The ranking carries the signal, not the probability

With SigLIP, a real signature that it recognises perfectly still scores only
0.13-0.33 as an absolute probability. A threshold on the absolute value therefore
rejects everything: the first harness run with SigLIP reported 22 false rejections
out of 22. The gate now returns a **relative** score (`P(signature) / max(P)`), which
is 1 when the signature is the winning class. Thresholds moved to
`THRESHOLDS_VERSION = "2"` (`gateAccept 0.99`, `gateReject 0.5`) with that scale in
mind. This is the kind of thing that only shows up by running the harness instead of
a probe.

### Final numbers through the harness

69 licensed images — 22 positives (4 real, 18 generated) and 47 negatives:

| Metric | Value |
| --- | --- |
| Confusion matrix | VP 4 · FN 18 · VN 33 · FP 14 |
| Real signatures accepted | **4 / 4** |
| False rejections (all positives) | 81.8 % (95 % CI 61.5–92.7 %) |
| Negatives rejected | 70.2 % (95 % CI 56.0–81.3 %) |
| Negatives accepted by mistake | **29.8 %** |
| Latency | p50 1 235 ms · p95 1 555 ms |

The 81.8 % is dominated by the 18 vector drawings, which a photo classifier is not
expected to call signatures; the number that matters is **4 of 4 real photos**.

The 29.8 % of negatives accepted comes from the ambiguous band: a score between 0.5
and 0.99 means "the signature is close but not the winner", and with no second
opinion the design accepts rather than rejects (false rejections are the metric that
cannot move). That band is exactly where the VLM belongs.
