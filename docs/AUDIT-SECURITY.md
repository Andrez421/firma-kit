# Auditoría de seguridad

Medida el 22 de octubre de 2026 sobre `main` (`c48cddd`), antes de la fase 4.
Alcance: el servicio del gate (`apps/eval/src/serve.ts`), el cliente del arnés, el
componente React, el pipeline del core y la cadena de CI.

## Resumen

El servicio es **de desarrollo y sin autenticación**, y hoy eso es explícito en el
README. Los hallazgos no son vulnerabilidades del módulo que se publicará, pero sí
importan en cuanto alguien lo deje levantado en una red compartida: cualquier página
web puede usarlo como oráculo y saturar la CPU.

## Hallazgos

### S1 — CORS abierto, sin autenticación, y peticiones simples (alta en red compartida)

`access-control-allow-origin: *` en todas las respuestas, sin token ni origen
permitido. Un `POST` con cuerpo binario y sin cabeceras personalizadas es una
*petición simple*: **no dispara preflight**, así que cualquier sitio que la persona
visite puede llamar al servicio —incluso atado a `127.0.0.1`— y leer la respuesta,
porque CORS lo permite. En la práctica: un oráculo de "¿esto parece una firma?" y
un consumo de CPU a voluntad.

**Arreglo**: si escucha en `0.0.0.0`, exigir un token compartido por cabecera; y
restringir `access-control-allow-origin` al origen del arnés (o a una lista corta)
en vez de `*`. El token convierte la petición en no simple, así que además obliga a
preflight y mata el vector CSRF.

### S2 — Sin límite de tasa ni de concurrencia (alta en red compartida)

Diez peticiones simultáneas: **10/10 aceptadas**, 14.2 s de CPU con el bucle de
eventos ocupado. No hay cubo de fichas, ni máximo de peticiones en vuelo, ni
`429`/`503`. Cualquiera en la red puede dejar el servicio inútil.

**Arreglo**: máximo de peticiones en vuelo (1–2) con `503` y `Retry-After`, más un
cubo de fichas por IP.

### S3 — Sin timeout de petición: un cuerpo lento ocupa la conexión (media)

Envié cabeceras y 10 bytes y la conexión **seguía abierta a los 12 s**; no hay
`requestTimeout`, `headersTimeout` ni `keepAliveTimeout` propios, así que aplican
los de Node (hasta 300 s para el cuerpo). Con N conexiones lentas se agota el
servidor sin gastar CPU.

**Arreglo**: fijar `headersTimeout` (~10 s), `requestTimeout` (~30 s) y
`keepAliveTimeout`, y destruir la petición si el cuerpo se estanca.

### S4 — El 413 resetea la conexión y envenena el pool del cliente (media)

Con un cuerpo de 15 MB el servicio responde `413` y **destruye el socket**. La
siguiente petición del cliente que reutiliza esa conexión muere con `ECONNRESET`
—lo vi en la sonda: el proceso se cayó al pedir `/salud` con el socket reciclado—.
El arnés usa `fetch`, que tiene su propio pool: tras un rechazo por tamaño, la
siguiente verificación puede fallar sin motivo.

**Arreglo**: responder `413` con `Connection: close` explícito y consumir/descartar
el resto del cuerpo (`peticion.resume()`), o destruir solo después de que la
respuesta se haya escrito y cerrado.

### S5 — El cliente no tiene timeout ni reintento (media)

El verificador del arnés hace `fetch` sin `AbortSignal`
(`apps/playground/src/App.tsx`). Si el gate se cuelga, la persona se queda en
`busy` sin límite. Y no hay reintento: un parpadeo de red significa "no se validó",
en silencio (el aviso «sin servicio» ayuda, pero llega después).

**Arreglo**: `AbortSignal.timeout(8_000)`, un reintento con espera corta y jitter
solo en fallos de red (nunca en `413`), y que el componente trate el aborto como
*hay un fallo de verificación*, que es lo que ya hace: no bloquear a la persona.

### S6 — Contrato HTTP descuidado (baja)

`PUT /verificar`, `GET /verificar` y `POST /salud` responden **404**, no 405;
`OPTIONS` responde 404 sin `allow-methods`, así que un preflight legítimo falla.
Además el cuerpo puede ser **mayor** que `w*h*4` y se acepta en silencio.

**Arreglo**: 405 con `Allow`, preflight correcto, y exigir `datos.length ===
ancho*alto*4`.

### S7 — Sin rastro de auditoría ni cabeceras de defensa (baja)

El servicio solo escribe dos líneas al arrancar: no hay identificador de petición,
tamaño, veredicto ni duración, así que un abuso es invisible. Faltan
`X-Content-Type-Options: nosniff` y `Cache-Control: no-store` (un proxy intermedio
podría cachear veredictos).

**Arreglo**: una línea por petición (método, ruta, bytes, veredicto, ms, código) y
esas dos cabeceras.

### S8 — Acciones de CI ancladas a etiqueta, no a SHA (baja)

`actions/checkout@v4`, `pnpm/action-setup@v4` y `actions/setup-node@v4` se resuelven
por etiqueta móvil. Para un módulo público, un compromiso de la acción entra sin
que cambie el repositorio.

**Arreglo**: anclar a SHA completo con la etiqueta en comentario, y activar
Dependabot para actualizarlas.

## Lo que ya está bien

- **Sin secretos rastreados**: `git ls-files` no devuelve `.env`, claves ni
  credenciales.
- **El modelo no se descarga en caliente**: `allowRemoteModels = false`; sin
  descargas remotas ni rutas controladas por el cliente.
- **Tope de cuerpo de 12 MB** y validación de `w`/`h` (`0`, negativos, `NaN` y
  `1e9` se rechazan con 400).
- **Sin rutas de fichero**: no sirve estáticos, así que no hay *path traversal*;
  `/etc/passwd` y compañía dan 404.
- **Sin `eval` ni `new Function`** en core, react ni eval.
- **`pnpm.onlyBuiltDependencies`** acotado a tres paquetes: los scripts de
  instalación de dependencias no corren a ciegas.
- **El componente no bloquea a la persona** si el verificador falla: es la decisión
  correcta de producto (verificación como salvaguarda, no como requisito).

## Prioridad propuesta

1. **S1 + S2**: token y origen permitido, y techo de concurrencia. Van juntos
   porque los dos dependen de "quién puede llamar y cuánto".
2. **S3 + S4**: timeouts del servidor y cierre limpio tras `413`.
3. **S5**: timeout y un reintento en el cliente.
4. **S6 + S7**: contrato y registro.
5. **S8**: anclaje de acciones en CI.

## Nota de alcance

Nada de esto afecta a `packages/core` ni a `packages/react` tal como se publicarán:
el modelo y el servicio son la implementación de referencia del verificador, no
parte del módulo. Si la fase 4 incluye una demo pública, **S1 y S2 son requisito
previo**, no mejora opcional.
