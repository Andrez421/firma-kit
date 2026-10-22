# Changesets

Los tres paquetes publicables (`@firma-kit/core`, `@firma-kit/react` y
`@firma-kit/verify`) se versionan juntos con [changesets](https://github.com/changesets/changesets).
Las apps (`demo`, `eval`, `playground`) están en `ignore`: no se publican y no deben
arrastrar versiones.

## Añadir un cambio

```bash
pnpm changeset
```

Elige los paquetes afectados, el tipo de salto (`patch`, `minor`, `major`) y escribe
el resumen en inglés: acabará en el `CHANGELOG.md` del paquete.

## Preparar una versión

```bash
pnpm version-packages   # aplica los cambios pendientes y sube versiones
```

Esto **no publica nada**. Publicar es decisión del dueño del proyecto (ADR-009) y hoy
no se ha hecho nunca: el registro sigue intacto.

## Publicar (cuando el dueño lo decida)

```bash
pnpm build
pnpm changeset publish
```

Antes de la primera publicación conviene comprobar el contenido real de cada paquete:

```bash
pnpm --filter @firma-kit/core pack --dry-run
pnpm --filter @firma-kit/react pack --dry-run
pnpm --filter @firma-kit/verify pack --dry-run
```
