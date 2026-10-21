# firma-kit

Reusable **signature module**: draw it, type it, upload a photo of it — with ink
extraction, background removal and on-device visual verification.

> Estado: **scaffold**. El pipeline de tinta ya está portado y probado; los
> componentes React y la verificación visual están en el roadmap
> ([`docs/PRODUCT.md`](docs/PRODUCT.md)).

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
| `@firma-kit/core` | Types, contract, ink pipeline (`extractSignature`, `flattenInk`, `stretchLevels`) | ported + tested |
| `@firma-kit/react` | `<FirmaField />` with the four tabs, accessible, styleable | planned |
| `@firma-kit/verify` | Two-tier CPU verification: MobileCLIP-S0 zero-shot → SmolVLM-256M | planned |

## Quick start (core today)

```bash
pnpm install
pnpm test        # 25 tests del pipeline de tinta
```

```ts
import { extractSignature, flattenInk, INK_MESSAGE } from "@firma-kit/core";

// `rgba` es la imagen compuesta sobre blanco (ImageData en el navegador,
// sharp en el servidor). Sin DOM, sin red.
const res = extractSignature(rgba, width, height);
if (!res.ok) throw new Error(INK_MESSAGE[res.reason]);
const plano = flattenInk(res.alpha, res.width, res.height, res.box);
```

## Docs

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — vision, scope, phases, non-goals.
- [`docs/SURVEY.md`](docs/SURVEY.md) — how the three existing implementations differ.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — packages, data flow, models, privacy.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs.

Español: [`README.es.md`](README.es.md).

## License

MIT for the code. Models keep their own licenses and are downloaded at
runtime, never vendored — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
