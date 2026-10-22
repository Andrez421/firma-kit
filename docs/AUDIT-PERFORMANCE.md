# Auditoría de rendimiento

Medida el 22 de octubre de 2026 sobre `main` (`c48cddd`), antes de la fase 4.

## Cómo se midió

- Banco de `packages/core/dist` en Node 26, `performance.now()`, mediana de 5
  repeticiones (frío y caliente donde aplica).
- Servicio del gate (`apps/eval/dist/serve.js`) con `GATE_HOST=0.0.0.0`, sonda por
  HTTP con cuerpos RGBA reales.
- Lectura del código de `packages/react/src/SignatureField.tsx` y de
  `packages/core/src/ink/pixels.ts` para confirmar de dónde sale cada coste.

**No medido**: un móvil real, la tailnet con latencia real, ni el corpus de 1 018
firmas completo. Los números de escritorio son el suelo, no el techo.

## Hallazgos

### P1 — El trazo se re-rasteriza entero en cada movimiento (grave)

Cada `pointermove` añade un punto a `strokes`, y el efecto de dibujo llama a
`rasterizeStroke(points, ...)` con **todos** los puntos acumulados
(`SignatureField.tsx:420-432`). El trabajo total de un trazo crece con el
cuadrado de sus puntos:

| Trazo | Coste de un solo rasterizado | Coste acumulado del trazo |
| --- | --- | --- |
| 200 puntos | 2.0 ms | 163 ms (0.81 ms por evento) |
| 1 000 puntos | 7.4 ms | **2 186 ms** (2.19 ms por evento) |
| 3 000 puntos | 12.5 ms | — (cada evento ya cuesta 12.5 ms) |

En escritorio el trazo medio se sostiene; el problema es el final: los últimos
eventos de un trazo largo cuestan 7–12 ms cada uno, y un móvil es 4–8 veces más
lento. Ahí aparece el tirón con el que la gente deja de firmar.

**Arreglo**: pintar de forma incremental. El `canvas` de 2D puede recibir solo el
segmento nuevo (de `punto[k-1]` a `punto[k]`), con el rasterizador puro reservado
para la firma final. Si se prefiere no tocar el pintado, un `requestAnimationFrame`
que agrupe los eventos ya baja el coste a un rasterizado por fotograma (~60/s en
vez de uno por evento).

### P2 — El pipeline hace hasta tres pasadas y ~100 MB transitorios (media)

`extractSignature` (`pixels.ts:150-180`) intenta la limpieza directa; si no llega a
`MIN_CONFIDENCE`, realza niveles y repite la limpieza sobre la versión realzada. En
ese camino:

- `localStats` asigna **cinco** `Float32Array(n)` por llamada y se llama una vez por
  `extractInk` y otra por `stretchLevels`;
- `confidence` vuelve a calcular `luminance` sobre la imagen completa, dos o tres
  veces;
- `despeckle` copia el canal alfa entero (`pixels.ts:577`).

A 1 200 × 1 200 px eso son ~1.44 M de píxeles y del orden de **100 MB** de
asignaciones transitorias en el peor caso, con 243 ms de CPU en frío y 153 ms en
caliente. El resultado es correcto — el pipeline está validado contra 1 018 firmas
reales — así que esto **no se toca sin un test que hoy falle**: primero un banco
que compare la salida byte a byte, después la optimización.

### P3 — El gate atiende en serie y sin cola (media)

| Escenario | Medición |
| --- | --- |
| Una petición | 1.35–1.65 s |
| Cuatro simultáneas | 5.8 s en total (1.55 / 2.92 / 4.26 / 5.80 s) |
| Diez simultáneas | 14.2 s en total |

Las peticiones se encolan sin límite: la latencia crece sin techo y no hay
respuesta de saturación. Con 1 s por imagen y un solo hilo de ONNX, la capacidad
real es de ~0.8 imágenes/s.

**Arreglo**: limitar peticiones en vuelo (1–2) y responder `503` con `Retry-After`
cuando la cola pase de un umbral corto; o agrupar en lote si el modelo lo permite.

### P4 — El cuerpo RGBA pesa cuatro veces lo necesario (baja)

`leerCuerpo` acumula trozos y hace `Buffer.concat`, y después `new
Uint8ClampedArray(...)` copia otra vez: cada imagen se materializa dos veces. Un
cuerpo de 12 MB tarda 2.3 s en atravesar el servicio y el RSS pasó de 401 MB en
reposo a 431 MB tras la ráfaga. **Arreglo**: reservar una sola vez y copiar trozo a
trozo; a futuro, aceptar PNG y decodificar en el servidor (el móvil subiría ~200 KB
en vez de 9.8 MB).

### P5 — Lo que ya está bien (para no tocarlo)

- Vista previa del modo escribir: 0.1 ms de layout y rasterizado; el `loadFont` por
  tecla lo cachea el navegador. No hace falta debounce.
- `scaleToWidth` de 2 400 × 1 600 a 900: 58.9 ms, una vez por confirmación.
- El gate carga el modelo una sola vez al arrancar (~1.1 s), no por petición.
- El object URL del preview se revoca al cambiar (`SignatureField.tsx:391-403`).
- `useMemo` en `points`, `coreOptions`, `typeCanvas` y los puertos por defecto evita
  trabajo repetido en cada render.

## Estado (22 de octubre de 2026)

Cerrados en la rama `fix/audit-fixes`:

- **P1** — el trazo ya no re-rasteriza el lienzo completo en cada movimiento. Con un
  fotograma por evento, 300 `pointermove` provocan **2** rasterizados completos
  (inicio y fin del trazo) en vez de 300, y 300 segmentos baratos en medio. La
  pasada exacta del final conserva el rasterizador puro como fuente de verdad.
- **P3** — el gate responde `503` con `Retry-After` cuando ya hay una petición en
  vuelo, en vez de encolar.
- **P4** — el cuerpo se reserva una vez cuando `content-length` es creíble; el
  camino de trozos queda para clientes *chunked* o que mienten sobre el tamaño.

Sigue abierto:

- **P2** — el pipeline de tinta. Necesita banco de paridad antes de tocarlo.

## Prioridad propuesta

1. **P1**, porque es lo que la persona siente al firmar.
2. **P3**, porque una cola sin techo convierte una demo en una espera indefinida.
3. **P4** (una copia menos y, si se acepta PNG, mucho menos tráfico).
4. **P2**, solo con banco de paridad y test previo; es el corazón validado del
   producto y el riesgo de tocarlo sin red es alto.
