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
no se fijan hasta tener 30–50 negativos reales (ver `docs/ARCHITECTURE.md`).

## ADR-004 — Idioma

**Contexto.** Quien mantiene el proyecto trabaja en español; el ecosistema open
source lee inglés.

**Decisión.** Código, identificadores y comentarios en inglés (los artefactos
técnicos por defecto); documentación pública con README en inglés y español;
mensajes de usuario del paquete en español con i18n en fase 4.

**Consecuencias.** Un solo idioma para el código y dos puertas de entrada para
la documentación.
