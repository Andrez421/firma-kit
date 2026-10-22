# Fase 4 — demo, publicación, adaptadores e i18n

Rama `feat/fase-4`. Objetivo: cerrar la última fase del producto según
`docs/PRODUCT.md` y los ADR vigentes. Documento de especificación: leer hasta
`## Log`.

## Specs

- **S1** — Alcance literal de la fase, de `docs/PRODUCT.md`: «`apps/demo`
  (Next.js), npm publication, adapters (Supabase/Prisma/S3), i18n».
- **S2** — `apps/demo` es una aplicación Next.js (App Router) que integra
  `@firma-kit/react` por workspace y demuestra los cuatro modos, los dos idiomas y
  la verificación visual. No guarda nada: el producto dice que «storing the
  signature belongs to the project that uses it».
- **S3** — La verificación del demo usa el servicio del gate ya existente
  (`apps/eval/src/serve.ts`), con token en `x-gate-token`. Si el servicio no está,
  el demo **no bloquea a la persona** y lo dice en pantalla: es la misma decisión de
  producto que en el arnés (la verificación es salvaguarda, no requisito).
- **S4** — El demo tiene que servir a la métrica de éxito del producto: «A new
  project integrates the module in **< 30 min** (component + callback)». Eso se
  cumple con una guía de integración copiable, no con más funciones.
- **S5** — Nada se publica en npm: `npm publish` es decisión del dueño. ADR-009
  dejó la publicación para cuando la fase 2 cerrara con `react` funcionando, y
  ADR-010 trae `changesets` en esta fase; ambas cosas habilitan publicar, no obligan
  a hacerlo.
- **S6** — Los artefactos técnicos van en inglés; la documentación de producto y los
  mensajes de usuario, en español neutro cuando el idioma activo es `es`
  (ADR-004 y su enmienda).

## Tasks

- **T1** — Scaffold de `apps/demo` con Next.js App Router: los cuatro modos, cambio
  de idioma, resultado descargable, verificador contra el gate y guía de integración.
  Commit: `feat(demo): a Next.js app that shows the module and how to integrate it`.
- **T2** — Preparar la publicación sin publicar: `changesets`, metadatos de los tres
  paquetes (nombre, `files`, `repository`, `license`, `exports`) y `LICENSE`.
  Commit: `chore(release): prepare changesets and package metadata`.
- **T3** — Adaptadores de persistencia (Supabase/Prisma/S3). El dueño elige el orden
  y si cada uno es un paquete o un ejemplo.
- **T4** — Cerrar la deuda de i18n: `docs/DECISIONS.md` es el único documento que
  sigue solo en español.

## Log

- **L1** (dueño, intención registrada): «Make `firma-kit` a complete, independent
  signature module: four signing modes, correct ink pipeline, high-confidence visual
  verification, polished UI/UX, then phase 4 (demo, publication, adapters).»
- **L2** (dueño, restricción vigente): no publicar en npm todavía; el dueño decide
  cuándo.
- **L3** (hecho previo, contexto): fases 1–3 cerradas; auditorías de rendimiento y
  seguridad publicadas en `docs/` con los arreglos P1, P3, P4 y S1–S5 mergeados
  (PR #28). Deuda documentada: P2 (pipeline de tinta) y S6–S8 (contrato HTTP
  completo, registro de peticiones, acciones de CI ancladas a SHA).
