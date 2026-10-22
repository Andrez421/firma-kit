# Arreglos de las auditorías previos a la fase 4

Rama `fix/audit-fixes`. Objetivo: cerrar los hallazgos elegidos por el dueño —
**P1, P3, P4 y S1–S5** — de `docs/AUDIT-PERFORMANCE.md` y `docs/AUDIT-SECURITY.md`.
Quedan fuera, por decisión explícita: P2 (pipeline de tinta), S6–S8 (contrato HTTP
completo, registro de peticiones, anclaje de acciones de CI).
Documento de especificación: leer hasta `## Estado

- T1 hecho — `f8fc124` (555 líneas: reescritura de `serve.ts` más 12 tests del
  contrato; una sola unidad, no se parte sin dejar el servicio a medias).
- T2 hecho — `26c4df3`.
- T3 hecho — `7c402fb`. Medido en Chromium: 300 `pointermove` → 2 rasterizados
  completos.
- T4 hecho — este documento y las dos auditorías.

## Log`.

## Specs

- **S1** — El servicio del gate deja de aceptar a cualquiera: exige un token
  compartido por cabecera y restringe `access-control-allow-origin` a una lista de
  orígenes permitidos (`GATE_ORIGINS`), en vez de `*`. Con `GATE_HOST=0.0.0.0` y sin
  token, **se niega a arrancar**: es preferible un servicio que no levanta a uno
  abierto. La cabecera personalizada obliga a preflight, así que el servicio tiene
  que responder `OPTIONS` con `allow-methods` y `allow-headers`; sin eso el arnés
  dejaría de funcionar y el arreglo sería inútil.
- **S2** — Límite de tasa por IP (cubo de fichas) y techo de peticiones en vuelo.
  Al pasarse responde `429` o `503` con `Retry-After`, no deja la petición en cola.
- **S3** — El servidor fija `headersTimeout`, `requestTimeout` y
  `keepAliveTimeout`, configurables por opción para poder probarlos rápido. Un
  cuerpo que se estanca se cierra, no ocupa la conexión 300 s.
- **S4** — Un `413` responde con `Connection: close` y drena el cuerpo, de modo que
  el cliente no reutilice un socket muerto: el fallo `ECONNRESET` en la petición
  siguiente es un bug, no un efecto aceptable.
- **S5** — El verificador del arnés usa `AbortSignal.timeout`, y reintenta **una**
  vez con espera corta y jitter solo ante fallo de red, nunca ante `413` ni `429`.
  El componente sigue sin bloquear a la persona si la verificación falla.
- **P1** — El trazo deja de re-rasterizar el lienzo completo en cada `pointermove`.
  Durante el trazo se pinta solo el segmento nuevo; al soltar el puntero se hace
  **una** pasada con el rasterizador puro, que es el que define la firma guardada.
  El coste por evento pasa a ser constante y el resultado final no cambia.
- **P3** — El gate no encola sin techo: con una petición en vuelo, la siguiente
  recibe `503` con `Retry-After` en vez de esperar segundos.
- **P4** — El cuerpo se materializa una sola vez: si `content-length` es válido se
  reserva una vez y se copia trozo a trozo; nunca `Buffer.concat` más una copia.

## Tasks

- **T1** — Endurecer `apps/eval/src/serve.ts` (S1, S2, S3, S4, P3, P4) con tests del
  contrato HTTP. Commit: `fix(eval): the gate requires a token, limits load and closes cleanly`.
- **T2** — Verificador del arnés con timeout y un reintento (S5). Commit:
  `fix(playground): the verifier times out and retries once`.
- **T3** — Pintado incremental del trazo (P1) con test de paridad. Commit:
  `perf(react): paint the stroke incrementally instead of the whole canvas`.
- **T4** — READMEs y auditorías actualizadas con lo arreglado. Commit:
  `docs: record what the audits closed and what stays open`.

## Estado

- T1 hecho — `f8fc124` (555 líneas: reescritura de `serve.ts` más 12 tests del
  contrato; una sola unidad, no se parte sin dejar el servicio a medias).
- T2 hecho — `26c4df3`.
- T3 hecho — `7c402fb`. Medido en Chromium: 300 `pointermove` → 2 rasterizados
  completos.
- T4 hecho — este documento y las dos auditorías.

## Log

- **L1** (dueño, verbatim): «vale, ahora realiza 2 auditorias antes de la fase 4:
  optimizacion/rendimiento y seguridad (retry, timeouts, rate limits, etc)»
- **L2** (dueño, verbatim, al preguntar qué arreglos aplicar): «p1,p3,p4 y s1-s5»
- **L3** (evidencia): el 413 reseteaba el socket y mató el proceso de la sonda con
  `ECONNRESET`; el cuerpo lento seguía abierto a los 12 s; 10 peticiones simultáneas
  se aceptaron todas; el trazo de 1 000 puntos acumulaba 2.2 s de rasterizado.
