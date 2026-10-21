# Notas para agentes

Proyecto open source, módulo de firma reutilizable. Antes de escribir código:

1. Lee `docs/PRODUCT.md` (alcance y fases) y `docs/DECISIONS.md` (ADR vigentes).
2. El pipeline de tinta (`packages/core/src/tinta`) está **validado contra 1 018
   firmas reales**: no se reescribe sin un test que hoy falle.
3. `packages/core` es puro: sin DOM, sin React, sin red. Los efectos viven en
   `packages/react` y `packages/verify`.
4. Trabajo por fases (`docs/PRODUCT.md`): no adelantes la fase 3 si la 1 está
   abierta, salvo pedido explícito.
5. Tests: `pnpm test`. Tipos: `pnpm type-check`. Ambos en verde antes de cerrar.
6. Artefactos técnicos (código, tests, commits) en inglés; documentación de
   producto y mensajes de usuario en español neutro.
