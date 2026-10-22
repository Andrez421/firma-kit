# @firma-kit/verify

On-device visual verification for the image modes: **is this a signature, or a
photo of something else?** Two tiers, both on CPU, the image never leaves the
caller's process.

```ts
import { createTwoTierVerifier, THRESHOLDS } from "@firma-kit/verify";
import type { Verifier } from "@firma-kit/core";

const verifier: Verifier = createTwoTierVerifier({
  gate,                  // tier 1: score(image) -> 0..1
  secondOpinion,         // tier 2, only when the gate is ambiguous
  // thresholds: { gateAccept, gateReject }   // defaults are versioned
});
```

`<SignatureField verifier={verifier} />` passes it straight to `sign()`, which
classifies the **original** image before any cleanup.

## Why the package ships no models

The weights are hundreds of megabytes and their licences are their own
(ADR-003, ADR-011). They are downloaded into a volume, verified by SHA-256 and
never bundled:

```bash
export FIRMA_KIT_MODULES_DIR=/var/lib/firma-kit/modules
firma-kit-verify models pull      # explicit, never on a first request
firma-kit-verify doctor           # offline: what is missing, what mismatches
```

Every weight has its SHA-256 pinned in `src/models.ts`, and a test fails if one is
ever `null`: a weight without a hash has no verifiable provenance. `models pull`
refuses to download an unhashed file unless you pass `--allow-unverified` on
purpose, and a file on disk with a different hash is treated as corruption, never
silently replaced.

| Tier | Model | Licence | Role |
| --- | --- | --- | --- |
| 1 | **SigLIP base** (fused ONNX q8, 201 MB) | Apache-2.0 | gate: works, ~1.2 s |
| 2 | SmolVLM-256M Q8_0 + mmproj (≈270 MB) | Apache-2.0 | second opinion for the ambiguous band |

Tier 1 is SigLIP and not MobileCLIP: measured on real signature photos, MobileCLIP-S0
recognised none and S1 ordered signatures below documents. See
`docs/eval/gate-smoke.md` and the ADR-003 amendment.

Tier 2 uses `Q8_0` because the official `ggml-org` repository does not publish a
`Q4_K_M` quantisation; only `Q8_0` and `f16` exist. The official repository is
preferred over a third-party mirror.

The gate's score is **relative** (`P(signature) / max(P)`), 1 when the signature is
the winning class: zero-shot probabilities are not calibrated, and a real signature
SigLIP recognises can score 0.13 as an absolute value.

## Thresholds

`THRESHOLDS` and `THRESHOLDS_VERSION` live in `src/thresholds.ts` and a test pins
both. Changing them requires the evaluation report archived in `docs/eval/`,
because the metric that cannot move is **false rejections ≤ 1-2 % on real
signatures**: a false rejection leaves a person unable to sign, while a false
accept is found later.

The current numbers are provisional — they cannot be calibrated until 30-50 real
negatives exist. The bias is deliberate: with no second opinion, an ambiguous
score is **accepted** and recorded with its low confidence.

## Scope

This package decides "signature or not". It does **not** verify authorship or
identity: that would be biometrics, and it is out of scope by design.
