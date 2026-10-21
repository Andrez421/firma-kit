// Fase 3: dos niveles, ambos en CPU y sin salir de la infraestructura.
//   1. Gate rápido: zero-shot imagen↔texto (MobileCLIP-S0 int8, ~90 MB, ~50 ms).
//   2. Segunda opinión: VLM pequeño (SmolVLM-256M GGUF Q4, ~300 MB, ~1-2 s)
//      solo cuando el nivel 1 queda ambiguo.
// Ver docs/ARCHITECTURE.md y docs/DECISIONS.md (ADR-003).
export {};
