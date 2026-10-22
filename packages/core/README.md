<!-- English primary. Español: los mensajes de usuario del paquete son bilingües en
     tiempo de ejecución; la documentación vive en el README.es.md raíz y docs/*.es.md. -->

# @firma-kit/core

The framework-agnostic half of the signature module: the four ways of signing, the
ink pipeline that turns a photo into opaque ink on white, and the rejection
vocabulary. No DOM, no React, no network — everything that touches a canvas or a
file system arrives through a port.

```bash
pnpm add @firma-kit/core
```

## Sign

```ts
import { sign, type PngEncoder } from "@firma-kit/core";

declare const encoder: PngEncoder; // canvas in the browser, sharp in Node
declare const bitmap: Bitmap;

const result = await sign(
  { mode: "upload", image: bitmap },
  encoder,
  { locale: "es", maxWidth: 900 }
);

if (result.ok) {
  result.signature.png;       // Uint8Array, PNG, ink on white, ≤ 900 px wide
  result.signature.width;     // final size
  result.signature.createdAt; // ISO 8601
} else {
  result.reason;              // e.g. "not_a_signature", "no_ink", "dark_background"
  result.message;             // already translated, ready to show
}
```

`sign` accepts `mode: "draw" | "type" | "upload" | "camera"` and returns either a
`Signature` or a rejection with a reason and a message. The four modes share one
output contract, so the rest of your system never learns which one was used.

## What it guarantees

- **Opaque PNG on white.** Never a grey or black background — that was the defect
  that started this project.
- **At most 900 px wide** (`maxWidth`), which is a printed cell at 300 dpi.
- **Pure.** No `canvas`, no `sharp`, no `fetch`. The encoder, the text measurer, the
  text rasterizer and the visual verifier are all ports you supply.
- **Explained rejections.** Every refusal carries a `reason` and a message in
  English or Spanish, so a UI never has to invent its own copy.

## The pieces

| Export | What it is for |
| --- | --- |
| `sign(input, encoder, options)` | The whole flow: validate, clean, encode |
| `extractSignature(rgba, width, height)` | The ink pipeline on its own (Sauvola, level stretch, despeckle) |
| `rasterizeStroke(points, size, options)` | Draw mode rendering, shared with the React preview |
| `layoutTypedName(name, size, measurer, options)` | Type mode layout: lines, size, margins, clipping |
| `detectFormat(header)` | PNG/JPEG by magic bytes, so client and server agree |
| `rejectionMessage(reason, locale, overrides)` | The rejection vocabulary |

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `maxWidth` | `900` | Final PNG width |
| `maxAnalysisSide` | `1200` | Longest side analysed (phone memory) |
| `locale` | `"en"` | Language of the rejection messages (`"en"` / `"es"`) |
| `messages` | — | Override the copy of a specific rejection reason |
| `verifier` | — | Optional visual check; absent means "do not verify" |

## Visual verification

The verifier is a port: `{ verify(bitmap) }`. `@firma-kit/verify` implements it with
SigLIP; you can also point it at your own service. It is called on the **original**
image, before cleanup, because binarizing an ID card turns it into "a page with
text" and destroys the signal that gives it away. A verifier that throws does not
block the signature: verification is a safeguard, not a requirement.

## Links

- React component: [`@firma-kit/react`](../react/README.md)
- Verification: [`@firma-kit/verify`](../verify/README.md)
- Product, decisions and architecture: [`docs/`](../../docs/PRODUCT.md)
