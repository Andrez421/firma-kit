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
| `@firma-kit/react` | `<FirmaField />`: four tabs, accessible, CSS-variable theming | base done (phase 2) |
| `@firma-kit/verify` | Two-tier CPU verification: MobileCLIP-S0 zero-shot → SmolVLM-256M | port only, phase 3 |

## Quick start (core today)

```bash
pnpm install
pnpm test        # 83 tests: pipeline, contrato, modos y componente
```

```ts
import { firmar, INK_MESSAGE, type Bitmap } from "@firma-kit/core";

// `imagen` es lo que ya decodificó tu adaptador: ImageData en el navegador,
// sharp en el servidor. `core` no toca DOM ni red.
declare const imagen: Bitmap;
declare const encodePng: (b: Bitmap) => Promise<Uint8Array>;

const resultado = await firmar({ modo: "subir", imagen }, encodePng);
if (!resultado.ok) {
  // `motivo` es un código; `mensaje` ya está en español neutro.
  console.log(resultado.motivo, resultado.mensaje);
} else {
  // PNG opaco, tinta sobre blanco, <= 900px de ancho.
  console.log(resultado.firma.png.byteLength);
}
```

En React: `import { FirmaField } from "@firma-kit/react"` y su hoja
`@firma-kit/react/firma-kit.css`. Banco de pruebas manual con
`pnpm --filter @firma-kit/playground dev`.

## Docs

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — vision, scope, phases, non-goals.
- [`docs/SURVEY.md`](docs/SURVEY.md) — how the three existing implementations differ.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — packages, data flow, models, privacy.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs.

Español: [`README.es.md`](README.es.md).

## License

MIT for the code. Models keep their own licenses and are downloaded at
runtime, never vendored — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
