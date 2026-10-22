# Survey: the three existing implementations

Reviewed on 2026-10-21 by reading each project's code, not its documentation.

## pgaa (`~/Proyectos/pgaa`)

| File | Lines | What it does |
| --- | --- | --- |
| `lib/components/firma/SignatureCapture.tsx` | 328 | `canvas` and `upload` modes with `react-signature-canvas`. Returns `{dataUrl, type, width, height}` |
| `lib/utils/signature-cleaner.ts` | 244 | Its own cleanup: samples the border colour, RGB Euclidean distance (threshold 80), proportional alpha, auto-crop, max 500×200 |
| `app/aprendiz/matricula/nueva/components/CanvasFirma.tsx` | 411 | Canvas + upload + **photo** (`capture`), using the cleanup above |
| `app/actions/firma-actions.ts` | 258 | Stores `firma_<uid>.png` in Supabase Storage; delete and read |

Strengths: the cleanup accepts backgrounds of **any colour** and does not assume
white paper. Separate learner/tutor flows.
Weaknesses: no "type" mode; the cleanup is global (not adaptive) and untested;
the threshold of 80 leaves it defenceless against shadows and textures.

## GCly (`~/Proyectos/GCly`)

| File | Lines | What it does |
| --- | --- | --- |
| `apps/web/src/components/firma/firma-digital-section.tsx` | 242 | **Draw / Upload image / Type** tabs |
| `firma-dibujar.tsx` | 149 | Canvas |
| `firma-escribir.tsx` | 204 | Name in 4 Google fonts (Dancing Script, Pacifico, Great Vibes, Sacramento) and `html-to-image` to export a PNG |
| `firma-subir-imagen.tsx` | 252 | File |
| `firma-utils.ts` | 138 | `trimCanvas` (alpha crop), `canvasToBlob`, upload |
| `packages/database/.../0016_sellos_firma.sql` | 33 | **PAdES seal** evidence (certificate subject/serial/sha256, PDF sha256, date) |
| `.../0017_firma_opciones.sql` | 15 | Three flags: `firmar_word`, `firmar_pdf_imagen`, `firmar_pdf_certificado` |

Strengths: the "type" mode exists and works; monorepo with packages; a seal
evidence model.
Weaknesses: **no background cleanup** (a photo goes in as it is), fonts loaded
from Google Fonts at runtime (external dependency and layout shift), export via
`html-to-image` (a heavy dependency for a PNG of text).

## registro_asistencia (the mature reference)

- Ink pipeline **validated against 1 018 real signatures** in production:
  `extractSignature` (direct cleanup → cascade with level enhancement), crop to
  the stroke, flatten onto white, and gates (`no_ink`, `dark_background`,
  `not_a_signature`, `noise`). 25 tests.
- `dibujar` / `subir` / `foto` modes (no "type").
- Historical reprocessing with backup and atomic writes.

## What firma-kit unifies

| Need | pgaa | GCly | registro_asistencia | firma-kit |
| --- | --- | --- | --- | --- |
| Draw | yes | yes | yes | phase 1, done |
| Type with fonts | no | yes (Google Fonts) | no | phase 1, done (self-hosted OFL fonts) |
| Upload / photo | yes | yes (no cleanup) | yes + validation | phase 1, done |
| Ink cleanup | own, untested | no | validated | **ported** |
| Explained rejection | no | no | yes (5 reasons) | **ported**, now 9 reasons in English and Spanish |
| Visual verification | no | no | no | phase 3 |
| Tests | partial | yes (component) | 25 + 6 | 88 today |

Español: [`SURVEY.es.md`](SURVEY.es.md).
