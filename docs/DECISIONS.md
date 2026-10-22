# Decisiones (ADR)

Formato corto: contexto → decisión → consecuencias. Se añade al final; no se
reescribe el pasado.

## ADR-001 — Monorepo con pnpm + Turborepo, núcleo sin dependencias

**Contexto.** GCly ya es un monorepo con pnpm y Turborepo; pgaa y
registro_asistencia son aplicaciones sueltas. El módulo tiene que servir a los
tres.

**Decisión.** Monorepo pnpm con paquetes `core` / `react` / `verify`. `core` sin
dependencias de runtime (ni DOM ni red).

**Consecuencias.** Se puede consumir desde el navegador, una API, un worker o un
test de Node sin arrastrar React. Publicar `core` es barato; publicar `react`
exige decidir la estrategia de estilos.

## ADR-002 — El pipeline de tinta se porta, no se reescribe

**Contexto.** registro_asistencia tiene el único pipeline validado contra datos
reales (1 018 firmas). pgaa tiene otro sin pruebas; GCly no tiene.

**Decisión.** Se porta `extractSignature` / `flattenInk` / `stretchLevels` con
sus 25 tests, como `packages/core/src/tinta`.

**Consecuencias.** El nuevo proyecto arranca con la parte más difícil ya
resuelta. Cualquier mejora debe entrar por un test que hoy falla.

## ADR-003 — Verificación visual: MobileCLIP-S0 (gate) + SmolVLM-256M (segunda opinión)

**Contexto.** Se evaluaron modelos de decisión sobre texto (Jev, Laya, Kev):
ninguno ve imágenes, así que no resuelven "¿esto es una firma?". OCR se
descartó: una foto de un objeto no tiene texto. Se necesita visión, en CPU y
on-premise.

**Decisión.** Dos niveles. Gate barato con zero-shot imagen↔texto
(MobileCLIP-S0 int8, ~90 MB, ~50 ms) y segunda opinión con un VLM de 256M
(~300 MB, ~1–2 s) solo cuando el gate es ambiguo.

**Consecuencias.** El caso normal cuesta decenas de milisegundos; el caso dudoso
paga segundos. Sin GPU y sin sacar la imagen de la infraestructura. Los umbrales
no se fijan hasta tener 30–50 negativos reales (ver `docs/ARCHITECTURE.es.md`).

## ADR-004 — Idioma

**Contexto.** Quien mantiene el proyecto trabaja en español; el ecosistema open
source lee inglés.

**Decisión.** Código, identificadores y comentarios en inglés (los artefactos
técnicos por defecto); documentación pública con README en inglés y español;
mensajes de usuario del paquete en español con i18n en fase 4.

**Consecuencias.** Un solo idioma para el código y dos puertas de entrada para
la documentación.

## ADR-005 — El contrato de `core` usa puertos para todo lo que no es puro

**Contexto.** Codificar PNG necesita `canvas.toBlob` (navegador) o `sharp`
(servidor); medir y pintar texto necesita `fillText`; verificar necesita modelos
de cientos de megabytes. Ninguna de las tres cosas cabe en un paquete sin DOM,
sin React y sin red (ADR-001).

**Decisión.** `core` declara los puertos `EncodePng`, `MedidorTexto`,
`TextRasterizer` y `Verificador`, más `firmar(entrada, encoder, opciones)` como
entrada única. `Firma.png` es `Uint8Array` (no `Blob`): el mismo tipo sirve en
Node y en el navegador, sin copia. La presencia de `verificador` —no un booleano
aparte— es lo que activa la verificación.

**Consecuencias.** `react` y un futuro `@firma-kit/node` traen los adaptadores
cableados. Un contexto 2D ausente rechaza la promesa en vez de devolver un PNG
falso. El contrato se podía cambiar sin coste: nada estaba publicado.

## ADR-006 — Modo escribir: layout puro y cuatro cursivas OFL self-hosted

**Contexto.** GCly resolvió el modo escribir con cuatro fuentes de Google
cargadas en runtime y `html-to-image`. Dependencia externa, salto de layout y un
motor de captura pesado para pintar texto.

**Decisión.** El layout (líneas, tamaño, interlineado) vive en `core` y decide
con un medidor inyectado; el pintado entra por `TextRasterizer`. Fuentes: las
mismas cuatro de GCly (Caveat, Pacifico, Great Vibes, Sacramento), OFL,
servidas como woff2 desde el paquete, subconjunto `latin` de Google Fonts.

**Consecuencias.** Cero peticiones a Google Fonts en runtime y cero
`html-to-image`. El subconjunto `latin-ext` se descarta a propósito: no incluye
`á` ni `ñ`, así que «Muñoz» saldría mutilado. 142 KB de fuentes en el paquete.

## ADR-007 — Flags estrictos sobre el pipeline portado

**Contexto.** ADR-002 dice que el pipeline validado contra 1 018 firmas no se
reescribe. `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` obligan a
tocar 53 accesos indexados.

**Decisión.** Se activan en todo el repo. Las ediciones permitidas al pipeline
son solo declarativas (aserción de un índice acotado por construcción), van en
un commit aislado y se prueban con los tests existentes **más** una comparación
bit a bit contra la versión anterior sobre imágenes generadas.

**Consecuencias.** El código validado sigue siendo el mismo de verdad, y hay una
prueba —no una promesa— de que el cambio fue de tipos.

## ADR-008 — Capa React sin control externo obligatorio y con variables CSS

**Contexto.** El componente tiene que servir a un formulario con estado propio y
a una integración de dos líneas, dentro de un proyecto con Tailwind y en otro sin
él.

**Decisión.** No controlado por defecto (`onFirma`, `onRechazo`, ref imperativo
`limpiar`/`confirmar`/`abrirModo`), con `value` opcional para el caso
formulario. Estilos con tokens `--firma-*` en `firma-kit.css`, sin Tailwind y
sin CSS modules. `"use client"` en la entrada, peer `react >=18.3`, y subpath
`./server` con tipos solamente para leer el contrato desde un Server Component.

**Consecuencias.** Tailwind 4 como preset queda como mejora opcional, no como
dependencia. Un modo imposible no se ofrece: `escribir` sin nombre y `foto` sin
cámara desaparecen en lugar de fallar al pulsar.

## ADR-009 — No se publica en npm hasta cerrar la fase 2

**Contexto.** Los nombres `firma-kit`, `@firma-kit/core` y `@firma-kit/react`
están libres en el registro. Publicar congela el contrato.

**Decisión.** Nada de `npm publish` hasta que la fase 2 esté cerrada con
`react` funcionando. Aun así se reserva el scope `@firma-kit` en npm.

**Consecuencias.** Para consumir hoy: dependencia por ruta o `git`. Un `0.1.0`
con `core` y `react` juntos cuenta una sola historia de instalación.

## ADR-010 — CI mínimo ahora, publicación automatizada después

**Contexto.** El repositorio es público y no tenía CI. Con `0.1.0` fuera, un
`main` roto se propaga a quien lo instale.

**Decisión.** GitHub Actions con `pnpm install --frozen-lockfile`,
`pnpm type-check`, `pnpm test` y `pnpm build`, en Node 22 y 24. `changesets`
llega en la fase 4, cuando haya algo que publicar.

## ADR-011 — `verify` en proceso, con descarga explícita y umbrales versionados

**Contexto.** Los modelos no pueden empaquetarse (licencias y tamaño) y la
imagen no puede salir de la infraestructura del llamador.

**Decisión.** `@firma-kit/verify` implementa el puerto `Verificador` en el
proceso del llamador: gate con `transformers.js` sobre los ONNX int8 de
MobileCLIP-S0 (≈55 MB) y segunda opinión con `node-llama-cpp` sobre SmolVLM-256M
`Q4_K_M` + `mmproj` (≈300 MB, Apache-2.0). Los modelos se traen solo con
`firma-kit-verify models pull`, con SHA-256 pinneado y un `doctor` de
diagnóstico. Los umbrales viven en `umbrales.ts` con `UMBRALES_VERSION`, y
cambiarlos exige el reporte de evaluación archivado en `docs/eval/`.

**Consecuencias.** El sidecar es una decisión de despliegue del consumidor, no
un requisito del paquete. Un verificador que falla no bloquea a la persona: la
verificación es una salvaguarda extra.

## ADR-012 — El corpus de evaluación no vive en el repositorio público

**Contexto.** Las 1 018 firmas reales son trazos de personas identificables, y
con un solo negativo no se pueden fijar umbrales.

**Decisión.** `apps/eval` lee el corpus por `FIRMA_KIT_EVAL_CORPUS`. Al repo
público solo entran fixtures sintéticos (factura, pantallazo, PDF impreso,
cuadrícula, hoja vacía, objeto) y datasets públicos con licencia verificada una
por una. Cero documentos reales de personas.

**Consecuencias.** La métrica se valida en local; el arnés y los sintéticos se
revisan en público. El arnés sale con código 1 si los falsos rechazos superan el
2 % o los falsos aceptados bajan del 90 %.

## ADR-004 (enmienda) — Inglés primario, español completo

**Contexto.** La redacción original decía «código, identificadores y comentarios
en inglés», pero el andamiaje había fijado el contrato en español (`Firma`,
`OpcionesFirma`, `MotivoRechazo`) y los valores de los enums también
(`"sin_tinta"`, `"dibujar"`). Un contrato mitad en cada idioma no se puede
publicar: quien lo consuma escribe `resultado.firma.modo === "dibujar"` en un
código que se llama `extractSignature`.

**Decisión.** El inglés es el idioma primario del código y del contrato público:
tipos, campos, funciones, valores de enum, nombres de archivo, clases CSS y
títulos de test. El español se mantiene completo donde lo ve una persona: los
mensajes de rechazo (`messages/es.ts`), las etiquetas de la interfaz y la
documentación de producto. Ambos idiomas se sirven desde el paquete, y el idioma
por defecto es el inglés (`locale: "en"`), con `"es"` como opción explícita.

**Consecuencias.** Renombrar ahora costó un commit grande y no costó nada a
nadie: no había nada publicado. A partir de la publicación, el contrato es
estable y los cambios de nombre son breaking. Queda pendiente traducir al inglés
los documentos internos de `docs/` (producto, arquitectura, relevamiento), que
hoy siguen en español.
