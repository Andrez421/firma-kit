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

`models pull` refuses to download any file whose SHA-256 is not pinned unless you
pass `--allow-unverified` on purpose. A weight file with an unexpected hash is
treated as corruption, never silently replaced.

| Tier | Model | Licence | Role |
| --- | --- | --- | --- |
| 1 | MobileCLIP-S0 int8 (≈55 MB of ONNX) | Apple Sample Code | cheap gate, tens of ms |
| 2 | SmolVLM-256M Q4_K_M + mmproj (≈300 MB) | Apache-2.0 | second opinion only when ambiguous |

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
