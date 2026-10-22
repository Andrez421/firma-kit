# Architecture

## Packages

```
@firma-kit/core        no DOM, no React, no network
  ├── types.ts         contract: SignatureMode, Signature, SignatureResult, RejectionReason
  ├── sign.ts          sign(): one entry point for the four modes
  ├── image.ts         block-average downscale, never upscales
  ├── format.ts        PNG/JPEG by magic bytes, no decoding
  ├── verifier.ts      Verifier port (types only)
  ├── messages/        en.ts and es.ts copy for every rejection reason
  ├── modes/           draw.ts (stroke model) and type.ts (layout)
  └── ink/             pure pipeline: extractSignature, flattenInk, stretchLevels
@firma-kit/react       components + styles (CSS variables, Tailwind not required)
@firma-kit/verify      visual verification on CPU (MobileCLIP-S0 → SmolVLM-256M)
apps/playground        Vite bench for the four modes (private, not published)
apps/demo              Next.js exercising the four modes (phase 4)
```

Dependency rule: `react` and `verify` depend on `core`; `core` depends on nobody.
That is what lets the same module run in a browser, an API, a worker or a Node
test.

## Flow of a signature from an image

```
file/photo
   │  (browser: canvas → ImageData | server: sharp → RGBA buffer)
   ▼
scaleToMaxSide(bitmap, 1200)          ← memory ceiling for the analysis
   ▼
extractSignature(rgba, w, h)          ← core, ported and tested
   ├─ direct cleanup (local Sauvola)
   ├─ if not confident → stretchLevels (auto-levels) → cleanup again
   ├─ gates: no_ink · dark_background · not_a_signature · noise
   ▼
flattenInk(alpha, w, h, box)          ← ink on white, no alpha
   ▼
scaleToWidth(..., 900) → encoder → Signature { png, width, height, mode, createdAt }
```

`enhanced` on the result means the level cascade produced it, so the outcome can
be audited afterwards.

## Draw and type modes

Both keep the same split: the part that can be pure lives in `core`, the part
that needs a browser enters through a port.

- **Draw**: `rasterizeStroke` turns pointer samples into an antialiased bitmap;
  simulated pressure is derived from speed, so mouse, finger and stylus behave
  the same and the result is testable in Node.
- **Type**: `layoutTypedName` decides lines and font size from a `TextMeasurer`;
  `TextRasterizer` paints them. Four OFL fonts ship with the package
  (Caveat, Pacifico, Great Vibes, Sacramento, `latin` subset, 142 KB).

## Visual verification (phase 3)

Two tiers, **both on CPU**, the image never leaves the caller's infrastructure:

| Tier | Model | Size | Latency | Role |
| --- | --- | --- | --- | --- |
| 1 | MobileCLIP-S0 int8 (zero-shot image↔text) | budget ~90 MB | ~50 ms | gate: is the winning class "handwritten signature"? |
| 2 | SmolVLM-256M GGUF Q4 | ~300 MB | ~1–2 s | second opinion only when tier 1 is ambiguous |

The published int8 ONNX weights measure ≈55 MB (`vision_model_int8` 11.8 MB +
`text_model_int8` 42.8 MB); the tier-1 budget is reconciled when phase 3 sizes the
container.

Open classes for tier 1 (draft): "a handwritten signature on paper", "an ID card
or identity document", "an invoice or printed page", "a photo of an object", "a
screenshot", "a person".

Details already settled by the evidence:

- **The original image is classified**, not the cleaned one: binarising turns an
  ID card into a "page with text" and the signal is lost.
- Models are cached in a volume (`FIRMA_KIT_MODULES_DIR`), never bundled: their
  licences are their own.
- Privacy: an identity document is personal data (Ley 1581 de 2012 in Colombia).
  A cloud classifier is ruled out by design.

## Host cost

| Component | Disk | RAM in use |
| --- | --- | --- |
| core | — | a few MB per image ≤1200px |
| tier 1 | ~90 MB | ~200 MB |
| tier 2 | ~300 MB | ~500 MB–1 GB |

Everything fits the current container (no GPU). Tier 1 can run in the browser
with transformers.js if a project prefers it; tier 2 cannot.

## Validation (the real blocker)

There are 1 018 real signatures as positives and **one** negative. Before fixing
thresholds a batch of negatives is required (ID card, invoice, receipt,
screenshot, object, hand, blank page): **30–50** minimum. Metrics:

- false rejections on real signatures **≤ 1–2 %** (not negotiable);
- false accepts on negatives **≥ 90 %**.

Español: [`ARCHITECTURE.es.md`](ARCHITECTURE.es.md).
