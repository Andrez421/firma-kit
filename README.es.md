# firma-kit

Módulo de firma **reutilizable**: dibújala, escríbela o sube una foto — con
extracción de tinta, quita de fondo y verificación visual en el dispositivo.

> Estado: **andamiaje**. El pipeline de tinta ya está portado y probado; los
> componentes React y la verificación visual están en el roadmap
> ([`docs/PRODUCT.md`](docs/PRODUCT.md)).

## Por qué

El mismo módulo se escribió tres veces (pgaa, GCly, registro_asistencia), cada
uno con funciones distintas y su propia idea de "limpiar el fondo". Aquí se
unifica una sola vez, con pruebas, y se publica como paquetes que otras
aplicaciones pueden importar.

- **Cuatro formas de firmar**: `dibujar` (lienzo), `escribir` (tipografiada, con
  fuentes cursivas), `subir` (archivo) y `foto` (cámara).
- **Tinta, no fotografías**: los modos por imagen devuelven tinta negra sobre
  blanco, recortada al trazo — el algoritmo que corrigió los fondos grises y
  negros en 1 018 firmas reales en producción.
- **Rechazo honesto**: cuando la foto no es una firma (una cédula, una página
  con textura, un fondo oscuro) el módulo lo dice con un mensaje accionable en
  vez de guardar basura.
- **Verificación en el dispositivo**: modelos de visión en CPU, sin sacar la
  imagen de la infraestructura (un documento de identidad es dato personal).
- **Núcleo agnóstico**: `@firma-kit/core` no depende de DOM, React ni red;
  `@firma-kit/react` es la capa de interfaz.

## Paquetes

| Paquete | Qué es | Estado |
| --- | --- | --- |
| `@firma-kit/core` | Tipos, contrato, `firmar()` de los cuatro modos, pipeline de tinta | hecho (fase 1) |
| `@firma-kit/react` | `<SignatureField />`: cuatro pestañas, accesible, temas por CSS | base hecha (fase 2) |
| `@firma-kit/verify` | Verificación en dos niveles CPU | solo el puerto, fase 3 |

## Empezar (el núcleo, hoy)

```bash
pnpm install
pnpm test        # 83 tests del pipeline de tinta
```

## Documentación

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — visión, alcance, fases, no-alcance.
- [`docs/SURVEY.md`](docs/SURVEY.md) — cómo difieren las tres implementaciones.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — paquetes, flujo, modelos, privacidad.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADRs.

## Licencia

MIT para el código. Los modelos conservan su licencia y se descargan en
tiempo de ejecución, nunca se empaquetan.
