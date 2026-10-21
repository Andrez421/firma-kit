# Producto — firma-kit

## Problema

Tres proyectos del mismo ecosistema (pgaa, GCly, registro_asistencia) necesitaron
el mismo módulo de firma y cada uno lo escribió a su manera. El resultado: tres
niveles de calidad distintos, tres formas de limpiar el fondo (una sola
validada) y ningún sitio donde arreglar un defecto una vez para todos.

## Visión

Un paquete que cualquier proyecto importe y tenga, de una vez, el módulo de
firma completo: cuatro modos, limpieza de tinta correcta, rechazo explicable y
verificación visual en el dispositivo. Publicado como open source, con pruebas
y documentado para que un tercero lo use sin leer el código.

## Alcance (el módulo)

1. **Dibujar** — lienzo con puntero/táctil, trazo con presión simulada, limpiar,
   confirmación.
2. **Escribir** — el nombre en una de N fuentes cursivas, exportado a PNG.
3. **Subir imagen** — archivo PNG/JPEG, limpieza de tinta, recorte.
4. **Tomar foto** — cámara trasera (`capture`), mismo pipeline que subir.
5. **Contrato de salida** — siempre PNG opaco, tinta sobre blanco, ≤900px de ancho.
6. **Verificación visual** de los modos 3 y 4: rechazar lo que no es una firma.
7. **Capa React** accesible (teclado, lector de pantalla, 44px) y estilable.

## Fuera de alcance

- Verificar **autoría** o identidad (no es biometría ni peritaje caligráfico).
- Persistir: el módulo devuelve la firma; guardarla es del proyecto que lo usa
  (adaptadores opcionales en fases posteriores).
- Firma criptográfica / PAdES: GCly ya tiene su modelo de sellos; aquí solo se
  documentará cómo convive.
- Multi-tenant, cuentas, permisos.

## Fases

| Fase | Contenido | Estado |
| --- | --- | --- |
| 0 | Andamiaje, docs, contrato de tipos, pipeline de tinta portado + tests | **hecho** |
| 1 | `core`: puente canvas/ImageData, `dibujar`, `escribir` (fuentes self-hosted), `subir`/`foto` con el contrato | siguiente |
| 2 | `react`: `<FirmaField />`, estilos con CSS variables, a11y, tests de componente | |
| 3 | `verify`: MobileCLIP-S0 int8 (gate) + SmolVLM-256M (segunda opinión), umbrales y evals | |
| 4 | `apps/demo` (Next.js), publicación en npm, adaptadores (Supabase/Prisma/S3), i18n | |

## Métricas de éxito

- Un proyecto nuevo integra el módulo en **< 30 min** (componente + callback).
- **0** firmas impresas con fondo gris/negro (el defecto que originó todo).
- Falsos rechazos sobre firmas reales **≤ 1 %** (la métrica que no se negocia).
- `pnpm test` cubre el pipeline y los cuatro modos sin navegador real.

## Decisiones pendientes

- Nombre/lanzamiento en npm (¿`firma-kit` libre?) y si el primer release es
  `0.1.0` con solo `core` o se espera a `react`.
- Idioma de la API pública (inglés) frente a los mensajes de usuario (español
  primero, i18n después).
