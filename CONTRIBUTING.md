# Contribuir

## Requisitos

- Node >= 22.18 (ver `.nvmrc`)
- pnpm >= 11 (`corepack enable`)

## Flujo

```bash
pnpm install
pnpm test            # vitest, proyecto "core"
pnpm type-check
```

Convenciones:

- **Commits** en formato Conventional Commits (`feat(core): ...`).
- **Pruebas primero** cuando se toca el pipeline de tinta: un cambio de
  comportamiento entra con un test que falla antes.
- **Núcleo puro**: `packages/core` no importa DOM, React ni red. Si algo
  necesita `document` o `sharp`, va en un adaptador.
- **Mensajes de usuario** en español neutro; el código en inglés (ADR-004).

## Ideas de primera contribución

- Puente `ImageData` ↔ `extractSignature` con test en jsdom.
- `trimCanvas` compartido (pgaa y GCly tienen dos versiones).
- Fuentes cursivas self-hosted para el modo "escribir" (sin Google Fonts).
