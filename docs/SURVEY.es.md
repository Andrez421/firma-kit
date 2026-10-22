# Relevamiento: las tres implementaciones existentes

> Versión en español. La primaria es [`SURVEY.md`](SURVEY.md).


Revisado el 2026-10-21 leyendo el código de cada proyecto, no su documentación.

## pgaa (`~/Proyectos/pgaa`)

| Archivo | Líneas | Qué hace |
| --- | --- | --- |
| `lib/components/firma/SignatureCapture.tsx` | 328 | Modos `canvas` y `upload` con `react-signature-canvas`. Devuelve `{dataUrl, type, width, height}` |
| `lib/utils/signature-cleaner.ts` | 244 | Limpieza propia: muestrea el color de los bordes, distancia euclidiana RGB (umbral 80), alfa proporcional, auto-crop, máx 500×200 |
| `app/aprendiz/matricula/nueva/components/CanvasFirma.tsx` | 411 | Lienzo + subir + **foto** (`capture`), con la limpieza anterior |
| `app/actions/firma-actions.ts` | 258 | Guarda `firma_<uid>.png` en Supabase Storage; borrar y leer |

Fortalezas: la limpieza acepta fondos de **cualquier color** y no depende de
que el papel sea blanco. Flujos separados aprendiz/tutor.
Debilidades: sin modo "escribir"; la limpieza es global (no adaptativa) y no
tiene pruebas; el umbral 80 la deja indefensa ante sombras y texturas.

## GCly (`~/Proyectos/GCly`)

| Archivo | Líneas | Qué hace |
| --- | --- | --- |
| `apps/web/src/components/firma/firma-digital-section.tsx` | 242 | Pestañas **Dibujar / Subir imagen / Escribir** |
| `firma-dibujar.tsx` | 149 | Lienzo |
| `firma-escribir.tsx` | 204 | Nombre en 4 fuentes de Google (Dancing Script, Pacifico, Great Vibes, Sacramento) y `html-to-image` para exportar a PNG |
| `firma-subir-imagen.tsx` | 252 | Archivo |
| `firma-utils.ts` | 138 | `trimCanvas` (recorte por alfa), `canvasToBlob`, subida |
| `packages/database/.../0016_sellos_firma.sql` | 33 | Evidencia de **sello PAdES** (sujeto/serie/sha256 del certificado, sha256 del PDF, fecha) |
| `.../0017_firma_opciones.sql` | 15 | Tres flags: `firmar_word`, `firmar_pdf_imagen`, `firmar_pdf_certificado` |

Fortalezas: el modo "escribir" ya existe y funciona; monorepo con paquetes;
modelo de evidencia de sellado.
Debilidades: **sin limpieza de fondo** (una foto entra tal cual), fuentes
cargadas desde Google Fonts en runtime (dependencia externa y salto de layout),
exportación con `html-to-image` (dependencia pesada para un PNG de texto).

## registro_asistencia (este repo, la referencia madura)

- Pipeline de tinta **validado contra 1 018 firmas reales** en producción:
  `extractSignature` (limpieza directa → cascada con realce de niveles),
  recorte al trazo, aplanado sobre blanco y gates (`sin_tinta`,
  `fondo_oscuro`, `no_es_firma`, `ruido`; hoy `no_ink`, `dark_background`,
  `not_a_signature`, `noise`). 25 tests.
- Modos `dibujar` / `subir` / `foto` (sin "escribir").
- Reproceso histórico con respaldo y escritura atómica.

## Qué unifica firma-kit

| Necesidad | pgaa | GCly | registro_asistencia | firma-kit |
| --- | --- | --- | --- | --- |
| Dibujar | sí | sí | sí | fase 1, hecho |
| Escribir con fuentes | no | sí (Google Fonts) | no | fase 1, hecho (fuentes OFL self-hosted) |
| Subir / foto | sí | sí (sin limpieza) | sí + validación | fase 1, hecho |
| Limpieza de tinta | propia, sin tests | no | validada | **portada** |
| Rechazo explicable | no | no | sí (5 motivos) | **portado**, hoy 9 motivos en inglés y español |
| Verificación visual | no | no | no | fase 3 |
| Pruebas | parciales | sí (componente) | 25 + 6 | 88 hoy |
