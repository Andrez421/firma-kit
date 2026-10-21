# Fase 1 — `core` completo (cuatro modos) y capa React mínima

Rama `feat/fase-1-core`. Objetivo: cuatro modos en `core` sin DOM, contrato público
cerrado y `@firma-kit/react` con `<FirmaField />`. No se publica en npm (S5).
Documento de especificación: leer hasta `## Log`.

## Specs

- **S1** — `core` sigue puro (ADR-001): no toca `canvas` ni `sharp`. La codificación
  PNG entra por un puerto `EncodePng`; existe una función de conveniencia
  `firmar(encoder, …)` y los paquetes `react` y un futuro `@firma-kit/node` traen el
  encoder cableado. `Firma.png` pasa de `Blob` a `Uint8Array`; `react` añade helper
  `toBlob`. Nada está publicado: el cambio de contrato es gratis hoy.
- **S2** — `escribir` no rompe la pureza: `core` implementa el layout (líneas, tamaño,
  márgenes, recorte) y un puerto `TextRasterizer`; el adaptador rasteriza con
  `CanvasRenderingContext2D.fillText`. Fuentes: las 4 de GCly — Dancing Script,
  Pacifico, Great Vibes, Sacramento — self-hosted como woff2 subset latin+acentos con
  su licencia OFL en el paquete. Prohibido Google Fonts en runtime y prohibido
  `html-to-image` (se dibuja directo en canvas).
- **S3** — Decodificación de imagen y gates de formato/peso viven en el adaptador.
  `core` recibe un tipo estructural `Bitmap { data, width, height }` y expone
  `detectarFormato(cabecera)` puro (PNG/JPEG por magic bytes) para que
  `formato_no_soportado` se decida igual en cliente y servidor. Los tests del puente
  corren en Node puro: `ImageData` es estructuralmente `{ data, width, height }`, sin
  jsdom ni `canvas` nativo.
- **S4** — Mensajes de usuario en `core/src/mensajes/es.ts` (misma API pública que
  `INK_MESSAGE`), con override por `OpcionesFirma.mensajes`; `idioma: "es"` se queda
  hasta que exista `en.ts`.
- **S5** — No se publica en npm hasta cerrar la fase 2 con `react` funcionando. Aun
  así se reserva el scope `@firma-kit` en npm (crear la org, sin publicar).
- **S6** — CI mínimo en esta fase: `pnpm install --frozen-lockfile`, `pnpm test`,
  `pnpm type-check`, matriz Node 22 y 24. `changesets` se añade en la fase 4.
- **S7** — Corpus de negativos: sintéticos propios (factura, pantallazo, PDF impreso,
  cuadrícula, hoja vacía, objeto) más datasets públicos con licencia verificada una por
  una. Cero documentos reales de personas. Las 1 018 firmas reales **no se mueven** al
  repo público: `apps/eval` las lee por `FIRMA_KIT_EVAL_CORPUS`.
- **S8** — `<FirmaField />`: no controlado por defecto (`onFirma`, ref imperativo
  `limpiar`/`confirmar`/`abrirModo`, `value` opcional para formularios). Estilos con
  `firma-kit.css` propio y variables `--firma-*` (nada de Tailwind obligatorio).
  `"use client"` en el entry, peer `react >=18.3`, subpath `@firma-kit/react/server`
  solo con tipos. Cuatro modos por defecto, `modoInicial` explícito opcional,
  degradación `foto → subir` sin cámara y `escribir` oculto si no llega `nombre`.
- **S9** — `apps/playground` (Vite, no publicado) en esta fase: es la única forma de
  validar a ojo las fuentes self-hosted y el contrato "tinta sobre blanco".
- **S10** — `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activos en todo
  el repo. Las ediciones al pipeline portado son no conductuales, van en un commit
  aislado y se prueban con los 25 tests **más** equivalencia bit a bit contra `main`.
- **S11** — `verify` (fase 3, aquí solo el tipo): `core` declara el puerto
  `Verificador { verificar(imagen: Bitmap): Promise<Veredicto> }` sin dependencias;
  `react` lo acepta opcional; `@firma-kit/verify` lo implementa in-process
  (`transformers.js` con los ONNX int8 de MobileCLIP-S0: `vision_model_int8` 11,8 MB +
  `text_model_int8` 42,8 MB ≈ 55 MB, y `node-llama-cpp` con SmolVLM-256M `Q4_K_M`
  119 MB + `mmproj` 181 MB, Apache-2.0). Descarga solo por `firma-kit-verify models
  pull` con SHA-256 pinneado y `doctor`. Umbrales en `umbrales.ts` con
  `UMBRALES_VERSION`: cambiarlos exige reporte de eval archivado en `docs/eval/`.
  `apps/eval` emite matriz de confusión y sale con código 1 si falsos rechazos > 2 % o
  falsos aceptados < 90 %; en CI corre un verificador falso determinista.
- **S12** — Rama por fase y PR al cerrar; commits convencionales en inglés (ADR-004);
  `docs/DECISIONS.md` recibe ADR-005..012 con lo decidido.
- **S13** — `docs/ARCHITECTURE.md` corrige el peso del nivel 1 (~90 MB → ≈55 MB real en
  int8) al entrar en fase 3, no antes.

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Flags estrictos + ediciones no conductuales al pipeline | S10 | inline | `a08f2ea` |
| T2 | Contrato: `Bitmap`, `detectarFormato`, `EncodePng`, `Firma.png: Uint8Array`, `mensajes/es.ts`, puerto `Verificador` | S1 S3 S4 S11 | inline | `8c5b317` |
| T3 | Modo `dibujar`: trazo puro, rasterizado y escalado | S1 | inline | `0aadb36` |
| T4 | Modo `escribir`: layout puro + `TextRasterizer` + fuentes OFL | S2 | inline | `ba0f63f` |
| T5 | `firmar()`: verificación sobre la original, gates, recorte y contrato de salida | S1 S3 | inline | `238acff` |
| T6 | `<FirmaField />`, CSS variables, a11y, puertos de canvas, `/server` | S8 | inline (worker caído) | `7b8d578` |
| T7 | `apps/playground` (Vite) | S9 | inline | pendiente |
| T8 | Workflow de CI | S6 | inline | pendiente |
| T9 | ADR-005..012 y documentación | S12 | inline | pendiente |

Corte de slices: T1-T2 (≈400 líneas autoradas) y T3-T5, T6 en unidades propias.
Publicación (S5) no activa ninguna estrategia de entrega todavía.

Fuera de fase 1: `verify` funcional, publicación en npm, `apps/demo` Next.js, i18n.

## Log

- **L1** (handoff desde la sesión de registro_asistencia, verbatim): «Handoff desde la sesión de registro_asistencia. Este proyecto lo creé yo hace unos minutos; el contexto completo está en docs/ (PRODUCT, SURVEY, ARCHITECTURE, DECISIONS) y en el commit b8bc7df.

  ESTADO: repo público https://github.com/Andrez421/firma-kit (MIT, main al día, 33 archivos). Monorepo pnpm+turbo con core/react/verify. `pnpm install && pnpm test` → 24 tests verdes. Lo único funcional hoy es packages/core: contrato (ModoFirma dibujar/escribir/subir/foto, Firma, ResultadoFirma, MotivoRechazo) y el pipeline de tinta portado desde registro_asistencia, donde se validó contra 1018 firmas reales en producción (extractSignature con cascada de niveles, flattenInk, stretchLevels, 5 motivos de rechazo). react y verify son paquetes vacíos con el contrato de dependencias.

  POR QUÉ EXISTE: el mismo módulo se escribió 3 veces (pgaa: canvas+subir/foto con limpieza propia sin tests; GCly: canvas+subir+escribir con 4 Google Fonts y html-to-image pero SIN limpieza de fondo; registro_asistencia: el pipeline validado pero sin modo escribir). El relevamiento línea a línea está en docs/SURVEY.md.

  DECISIONES YA TOMADAS (ADR-001..004): core sin DOM/React/red; el pipeline se porta no se reescribe; verificación visual en dos niveles CPU (MobileCLIP-S0 int8 ~90MB/50ms como gate, SmolVLM-256M GGUF ~300MB/1-2s solo si hay duda, imagen nunca sale de la infraestructura porque una cédula es dato personal); README en inglés + español, código en inglés, mensajes de usuario en español.

  DECISIONES ABIERTAS (pregúntale al dueño antes de codificar): (1) alcance del primer npm release, solo @firma-kit/core 0.1.0 o esperar a react; (2) estilos de react, CSS variables propio o adaptador Tailwind 4; (3) fuentes del modo escribir self-hosted para no depender de Google Fonts en runtime; (4) verify como paquete en proceso o sidecar.

  SIGUIENTE PASO (fase 1): puente ImageData ↔ extractSignature con test en jsdom, los 4 modos en core, escribir con fuentes self-hosted, y ajustar noUncheckedIndexedAccess/exactOptionalPropertyTypes (hoy relajados por el código portado).

  BLOQUEO CONOCIDO de la fase 3: hay 1018 positivos reales y 1 solo negativo. Sin 30-50 negativos (cédula, factura, pantallazo, objeto) no se pueden fijar umbrales; la métrica que no se negocia es falsos rechazos ≤1-2% sobre firmas reales. El código de referencia del pipeline vive en ~/Proyectos/registro_asistencia (src/lib/firma-pixeles.ts y firma-normalizar.ts).

  Confirma recepción y dime si arrancas por fase 1 o prefieres cerrar primero las 4 decisiones abiertas.»
- **L2** (verbatim): «antes de iniicar con la implementacion, utiliza grill-me para realizar aparte de estas todas las preguntas pertitentes para implementar correctamente este proyecto.»
- **L3** (verbatim, ronda 1): «de esta ronda aplica todas las recomendaciones para cada pregunta excepto para la q5, esperemos a que tengamos algo mas maduro para publicar»
- **L4** (verbatim, ronda 2): «todo lo recomendado»
- **L5** (verbatim, ronda 3): «todas las recomendaciones»
- **D1** — Hecho verificado, no supuesto: `firma-kit`, `@firma-kit/core` y `@firma-kit/react` están libres en el registro npm (HTTP 404 en los tres). El repo no tiene `.github/`.
- **D2** — Corrección de hecho: el gate del nivel 1 no pesa ~90 MB. `Xenova/mobileclip_s0` publica los ONNX cuantizados int8 (`vision_model_int8.onnx` 11,8 MB, `text_model_int8.onnx` 42,8 MB) ≈ 55 MB. SmolVLM-256M GGUF: `Q4_K_M` 119 MB + `mmproj` 181 MB, Apache-2.0. Se corrige en fase 3 (S13).
- **D3** — El puente no necesita jsdom: `ImageData` es estructuralmente `{ data, width, height }` y jsdom no implementa canvas 2D sin el paquete nativo `canvas`. El test del handoff queda sustituido por S3.
- **D4** — Tensión detectada y resuelta en ronda 1: ADR-001 prohíbe DOM en `core` y el modo `escribir` exige rasterizar texto. Se resuelve con el puerto `TextRasterizer` (S2), no relajando ADR-001.
- **E1** — Evidencia T1: `tsc` con los flags estrictos pasa de 55 errores a 0; los 24 tests verdes; equivalencia bit a bit contra `main` en 1260 casos (18 imágenes generadas × 6 tamaños × 7 juegos de opciones sobre `extractInk`, `extractSignature`, `stretchLevels`, `flattenInk`, `countInk`): 0 diferencias.

- **D5** — Motivo nuevo `fuente_no_disponible` en `MotivoRechazo`: una cursiva que
  no cargó es un estado del sistema accionable y no encaja en `ilegible`.
- **D6** — `extractSignature` gana `realzada?: true` en su resultado correcto para
  que `Firma.realzada` sea evidencia y no una suposición. Es aditivo: los 25 tests
  del pipeline siguen verdes.
- **D7** — **Decisión pendiente del dueño**: ADR-004 pide identificadores en
  inglés, pero el contrato del andamiaje está en español (`Firma`, `OpcionesFirma`,
  `MotivoRechazo`, `detectarFormato`, `mensajeRechazo`). La implementación siguió
  el patrón existente — contrato en español, capa algorítmica en inglés
  (`rasterizeStroke`, `smoothStroke`, `scaleToWidth`) —, porque renombrar en
  caliente habría roto `README` y `docs/PRODUCT`. Hay que decidir antes de publicar:
  enmendar ADR-004 o renombrar el contrato.
- **D8** — pnpm 11 bloquea los scripts de instalación: `esbuild` (empaquetador de
  Vite, solo dev del playground) se autorizó en `pnpm-workspace.yaml` con
  `allowBuilds`. Es la única dependencia con script de instalación del repo.
- **D9** — El playground compila (`vite build`) y empaqueta las cuatro fuentes; la
  verificación visual (tildes, `ñ`, tinta sobre blanco, táctil, lector de
  pantalla) queda pendiente de una persona con navegador: este entorno no tiene
  navegador gráfico.
- **D10** — El agente `gentle-ai-worker` falló dos veces con "assistant reported an
  error" antes de editar nada; T5 y T6 se hicieron inline y queda reportado como
  subagente no disponible, no como éxito.
- **E2** — Evidencia acumulada: 83 tests verdes (10 archivos, proyectos `core` y
  `react`), `pnpm type-check` y `pnpm build` en verde en todo el workspace.
