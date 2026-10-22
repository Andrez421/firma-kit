# Decisions (ADR)

Short format: context → decision → consequences. New entries go at the end; the past
is not rewritten.

## ADR-001 — Monorepo with pnpm + Turborepo, dependency-free core

**Context.** GCly is already a monorepo with pnpm and Turborepo; pgaa and
registro_asistencia are standalone applications. The module has to serve all three.

**Decision.** A pnpm monorepo with `core` / `react` / `verify` packages. `core` has no
runtime dependencies (no DOM, no network).

**Consequences.** It can be consumed from a browser, an API, a worker or a Node test
without dragging React along. Publishing `core` is cheap; publishing `react` forces a
decision about the styling strategy.

## ADR-002 — The ink pipeline is ported, not rewritten

**Context.** registro_asistencia has the only pipeline validated against real data
(1 018 signatures). pgaa has another one with no tests; GCly has none.

**Decision.** `extractSignature` / `flattenInk` / `stretchLevels` are ported with their
25 tests, as `packages/core/src/tinta`.

**Consequences.** The new project starts with the hardest part already solved. Any
improvement has to come in through a test that fails today.

## ADR-003 — Visual verification: MobileCLIP-S0 (gate) + SmolVLM-256M (second opinion)

**Context.** Text-decision models were evaluated (Jev, Laya, Kev): none of them sees
images, so none answers "is this a signature?". OCR was discarded: a photo of an object
contains no text. Vision is needed, on CPU and on-premise.

**Decision.** Two levels. A cheap gate with zero-shot image↔text (MobileCLIP-S0 int8,
~90 MB, ~50 ms) and a second opinion with a 256M VLM (~300 MB, ~1–2 s) only when the
gate is ambiguous.

**Consequences.** The normal case costs tens of milliseconds; the doubtful one pays
seconds. No GPU, and the image never leaves the caller's infrastructure. Thresholds are
not fixed until there are 30–50 real negatives (see `docs/ARCHITECTURE.es.md`).

## ADR-004 — Language

**Context.** Whoever maintains the project works in Spanish; the open source ecosystem
reads English.

**Decision.** Code, identifiers and comments in English (technical artefacts by
default); public documentation with a README in English and Spanish; package user
messages in Spanish with i18n in phase 4.

**Consequences.** One language for code and two entry points for documentation.

## ADR-005 — The `core` contract uses ports for everything that is not pure

**Context.** Encoding a PNG needs `canvas.toBlob` (browser) or `sharp` (server);
measuring and painting text needs `fillText`; verifying needs models of hundreds of
megabytes. None of the three fits in a package without DOM, without React and without
network (ADR-001).

**Decision.** `core` declares the `EncodePng`, `MedidorTexto`, `TextRasterizer` and
`Verificador` ports, plus `firmar(entrada, encoder, opciones)` as the single entry
point. `Firma.png` is a `Uint8Array` (not a `Blob`): the same type works in Node and in
the browser, with no copy. The presence of `verificador` — not a separate boolean — is
what turns verification on.

**Consequences.** `react` and a future `@firma-kit/node` ship the adapters wired up. A
missing 2D context rejects the promise instead of returning a fake PNG. The contract
could be changed at no cost: nothing was published.

## ADR-006 — Type mode: pure layout and four self-hosted OFL cursives

**Context.** GCly solved type mode with four Google Fonts loaded at runtime and
`html-to-image`. An external dependency, a layout shift, and a heavy capture engine for
painting text.

**Decision.** The layout (lines, size, line height) lives in `core` and decides with an
injected measurer; painting comes in through `TextRasterizer`. Fonts: the same four from
GCly (Caveat, Pacifico, Great Vibes, Sacramento), OFL, served as woff2 from the package,
`latin` subset of Google Fonts.

**Consequences.** Zero requests to Google Fonts at runtime and zero `html-to-image`. The
`latin-ext` subset is discarded on purpose: it does not include `á` or `ñ`, so «Muñoz»
would come out mutilated. 142 KB of fonts in the package.

## ADR-007 — Strict flags on the ported pipeline

**Context.** ADR-002 says the pipeline validated against 1 018 signatures is not
rewritten. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` force 53 indexed
accesses to be touched.

**Decision.** They are enabled across the repo. The edits allowed to the pipeline are
declarative only (asserting an index that is bounded by construction), they go in an
isolated commit, and they are tested with the existing tests **plus** a bit-for-bit
comparison against the previous version on generated images.

**Consequences.** The validated code really is the same, and there is a proof — not a
promise — that the change was about types.

## ADR-008 — React layer without mandatory external control, styled with CSS variables

**Context.** The component has to serve a form with its own state and a two-line
integration, inside a project with Tailwind and in another one without it.

**Decision.** Uncontrolled by default (`onFirma`, `onRechazo`, imperative ref
`limpiar`/`confirmar`/`abrirModo`), with an optional `value` for the form case. Styles
with `--firma-*` tokens in `firma-kit.css`, no Tailwind and no CSS modules. `"use client"`
in the entry, peer `react >=18.3`, and a `./server` subpath with types only, to read the
contract from a Server Component.

**Consequences.** Tailwind 4 as a preset stays an optional improvement, not a
dependency. An impossible mode is not offered: `escribir` without a name and `foto`
without a camera disappear instead of failing on click.

## ADR-009 — Nothing is published to npm until phase 2 closes

**Context.** The names `firma-kit`, `@firma-kit/core` and `@firma-kit/react` are free in
the registry. Publishing freezes the contract.

**Decision.** No `npm publish` until phase 2 is closed with `react` working. The
`@firma-kit` scope is reserved in npm anyway.

**Consequences.** To consume it today: a path or `git` dependency. A `0.1.0` with `core`
and `react` together tells a single installation story.

## ADR-010 — Minimal CI now, automated publication later

**Context.** The repository is public and had no CI. With `0.1.0` out, a broken `main`
spreads to whoever installs it.

**Decision.** GitHub Actions with `pnpm install --frozen-lockfile`, `pnpm type-check`,
`pnpm test` and `pnpm build`, on Node 22 and 24. `changesets` arrives in phase 4, when
there is something to publish.

## ADR-011 — `verify` in process, with explicit download and versioned thresholds

**Context.** The models cannot be packaged (licences and size) and the image cannot
leave the caller's infrastructure.

**Decision.** `@firma-kit/verify` implements the `Verificador` port in the caller's
process: a gate with `transformers.js` over the MobileCLIP-S0 int8 ONNX files (~55 MB)
and a second opinion with `node-llama-cpp` over SmolVLM-256M `Q4_K_M` + `mmproj`
(~300 MB, Apache-2.0). Models are fetched only with `firma-kit-verify models pull`, with
pinned SHA-256 and a diagnostic `doctor`. Thresholds live in `umbrales.ts` with
`UMBRALES_VERSION`, and changing them requires the evaluation report archived in
`docs/eval/`.

**Consequences.** The sidecar is a deployment decision of the consumer, not a
requirement of the package. A verifier that fails does not block the person: verification
is an extra safeguard.

## ADR-012 — The evaluation corpus does not live in the public repository

**Context.** The 1 018 real signatures are strokes of identifiable people, and with a
single negative no threshold can be fixed.

**Decision.** `apps/eval` reads the corpus through `FIRMA_KIT_EVAL_CORPUS`. Only
synthetic fixtures (invoice, screenshot, printed PDF, grid, empty sheet, object) and
public datasets with a licence verified one by one enter the public repo. Zero real
documents of real people.

**Consequences.** The metric is validated locally; the harness and the synthetic
fixtures are reviewed in public. The harness exits with code 1 if false rejections
exceed 2 % or false accepts fall below 90 %.

## ADR-004 (amendment) — English primary, complete Spanish

**Context.** The original wording said "code, identifiers and comments in English", but
the scaffolding had fixed the contract in Spanish (`Firma`, `OpcionesFirma`,
`MotivoRechazo`) and so had the enum values (`"sin_tinta"`, `"dibujar"`). A contract half
in each language cannot be published: whoever consumes it writes
`resultado.firma.modo === "dibujar"` inside code called `extractSignature`.

**Decision.** English is the primary language of the code and the public contract: types,
fields, functions, enum values, file names, CSS classes and test titles. Spanish is kept
complete where a person sees it: the rejection messages (`messages/es.ts`), the interface
labels and the product documentation. Both languages are served from the package, and the
default language is English (`locale: "en"`), with `"es"` as an explicit option.

**Consequences.** Renaming now cost one large commit and cost nobody anything: nothing
was published. From publication onwards the contract is stable and name changes are
breaking. Translating the internal documents in `docs/` (product, architecture, survey)
into English is still pending; they remain in Spanish today.

## ADR-003 (amendment) — level 1 is SigLIP, and its score is relative

**Context.** The original wording proposed MobileCLIP-S0 int8 (~90 MB, ~50 ms) as the
cheap gate. Measured on four real photos of handwritten signatures and 47 negatives,
MobileCLIP-S0 **recognises none** (0/4) with four different prompt sets; its S1 variant
gets 3/4 but ranks signatures below documents, so no threshold separates the classes.

**Decision.** Level 1 is **SigLIP base** (fused q8 ONNX, 201 MB verified by SHA-256). It
recognises 4 of 4 real signatures through the harness and rejects 70 % of the negatives,
at ~1.2 s per image. The gate returns a **relative** score (`P(signature) / max(P)`), not
an absolute probability: zero-shot probabilities are uncalibrated and a recognised
signature scores 0.13–0.33.

**Consequences.** The "cheap 50 ms gate" does not exist: upload/camera move to ~1.2 s p50,
acceptable for a signature but not for a flow with many images. The ambiguous band
(0.5–0.99) accepts today, which is why 29.8 % of the negatives pass; the VLM is the second
opinion that should decide there. Thresholds remain provisional: with 4 real positives the
false-rejection rate cannot be asserted, and with zero errors the 3/N bound asks for 150.

---

Español: [`DECISIONS.es.md`](DECISIONS.es.md).

*Identifiers quoted inside each ADR are the ones in use on the date of that decision.
The public contract uses English names today: `sign`, `extractSignature`, `onSignature`,
`--signature-*`.*
