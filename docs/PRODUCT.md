# Product — firma-kit

## Problem

Three projects in the same ecosystem (pgaa, GCly, registro_asistencia) needed the
same signature module and each one wrote it its own way. The result: three
different quality levels, three ways of cleaning the background (only one of them
validated) and nowhere to fix a defect once for everybody.

## Vision

A package any project can import and get, in one go, the complete signature
module: four modes, correct ink cleanup, explained rejection and on-device visual
verification. Open source, tested, and documented so a third party can use it
without reading the code.

## Scope (the module)

1. **Draw** — canvas with pointer/touch, simulated-pressure stroke, clear,
   confirmation.
2. **Type** — the name in one of N cursive fonts, exported to PNG.
3. **Upload image** — PNG/JPEG file, ink cleanup, crop.
4. **Take a photo** — rear camera (`capture`), same pipeline as upload.
5. **Output contract** — always an opaque PNG, ink on white, ≤900px wide.
6. **Visual verification** of the image modes: reject what is not a signature.
7. **React layer**, accessible (keyboard, screen reader, 44px targets) and
   styleable.

## Out of scope

- Verifying **authorship** or identity (this is not biometrics or handwriting
  expertise).
- Persisting: the module returns the signature; storing it belongs to the project
  that uses it (optional adapters in later phases).
- Cryptographic signature / PAdES: GCly already has its seal model; here we only
  document how the two coexist.
- Multi-tenant, accounts, permissions.

## Phases

| Phase | Content | Status |
| --- | --- | --- |
| 0 | Scaffolding, docs, type contract, ported ink pipeline + tests | **done** |
| 1 | `core`: structural `Bitmap`, `draw`, `type` (self-hosted fonts), `upload`/`camera`, `sign()` | **done** |
| 2 | `react`: `<SignatureField />`, CSS-variable styles, a11y, component tests | **done** (publication still deferred by the owner) |
| 3 | `verify`: image-text gate + visual harness, thresholds and evals | **done**: SigLIP base is the gate (4/4 real signatures on the harness); the VLM second opinion is parked as a measured improvement |
| 4 | `apps/demo` (Next.js), npm publication, adapters (Supabase/Prisma/S3), i18n | next |

## Success metrics

- A new project integrates the module in **< 30 min** (component + callback).
- **0** signatures printed with a grey/black background (the defect that started
  all of this).
- False rejections on real signatures **≤ 1 %** (the metric that is not
  negotiable).
- `pnpm test` covers the pipeline and the four modes with no real browser.

## Open decisions

- npm name/release: the `firma-kit` scope is free, and ADR-009 sets publication
  for when phase 2 closes with `react` working. Nothing is published yet.
- ~~Language of the public API versus user messages~~: settled by the ADR-004
  amendment — English contract, messages in English and Spanish.
- ~~`docs/DECISIONS.md` Spanish only~~: settled — the ADRs are bilingual like the
  rest (`DECISIONS.es.md` next to the English file).

Español: [`PRODUCT.es.md`](PRODUCT.es.md).
