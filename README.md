# firma-kit

Reusable **signature module**: draw it, type it, upload a photo of it — with ink
extraction, background removal and on-device visual verification.

> Estado: **fase 1 cerrada**. Los cuatro modos funcionan en `core` sin DOM y
> `<FirmaField />` ya los ofrece en React; la verificación visual está en el
> roadmap ([`docs/PRODUCT.md`](docs/PRODUCT.md)). Nada publicado en npm todavía.

## Why

The same module has been written three times (pgaa, GCly, registro_asistencia),
each with a different feature set and a different idea of "clean the
background". This project unifies it once, with tests, and ships it as
packages other apps can import.

- **Four ways to sign**: `dibujar` (canvas), `escribir` (typed, cursive fonts),
  `subir` (file) and `foto` (camera capture).
- **Ink, not photographs**: the image modes return black ink on white, cropped
  to the stroke — the algorithm that fixed grey/black backgrounds on 1 018 real
  signatures in production.
- **Honest rejection**: when a photo is not a signature (an ID card, a textured
  page, a dark background) the module says so with an actionable message
  instead of storing junk.
- **On-device verification**: CPU-only vision models, no image ever leaves your
  infrastructure (ID documents are personal data).
- **Framework-agnostic core**: `@firma-kit/core` has no DOM, React or network
  dependency; `@firma-kit/react` is the UI layer.

## Packages

| Package | What | Status |
| --- | --- | --- |
| `@firma-kit/core` | Types, contract, `firmar()` for the four modes, ink pipeline (`extractSignature`, `flattenInk`, `stretchLevels`) | done (phase 1) |
| `@firma-kit/react` | `<SignatureField />`: four tabs, accessible, CSS-variable theming | base done (phase 2) |
| `@firma-kit/verify` | Two-tier CPU verification: MobileCLIP-S0 zero-shot → SmolVLM-256M | port only, phase 3 |

## Quick start (core today)

```bash
pnpm install
pnpm test        # 83 tests: pipeline, contrato, modos y componente
```

```ts
import { sign, MESSAGES_EN, type Bitmap } from "@firma-kit/core";

// `image` is whatever your adapter already decoded: ImageData in the browser,
// a sharp buffer on the server. `core` touches no DOM and no network.
declare const image: Bitmap;
declare const encodePng: (bitmap: Bitmap) => Promise<Uint8Array>;

const result = await sign({ mode: "upload", image }, encodePng);
if (!result.ok) {
  // `reason` is a code; `message` is already written for the person signing.
  console.log(result.reason, result.message);
} else {
  // Opaque PNG, ink on white, <= 900px wide.
  console.log(result.signature.png.byteLength);
}
```

In React: `import { SignatureField } from "@firma-kit/react"` plus its
stylesheet `@firma-kit/react/firma-kit.css`. Manual test bench:
`pnpm --filter @firma-kit/playground dev`.

## Docs

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — vision, scope, phases, non-goals.
- [`docs/SURVEY.md`](docs/SURVEY.md) — how the three existing implementations differ.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — packages, data flow, models, privacy.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs (Spanish).

Spanish: every doc has a `*.es.md` twin (`PRODUCT.es.md`, `ARCHITECTURE.es.md`, `SURVEY.es.md`).

Español: [`README.es.md`](README.es.md).

## License

MIT for the code. Models keep their own licenses and are downloaded at
runtime, never vendored — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
