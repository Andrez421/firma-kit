// Verificación visual en dos niveles, en CPU y sin sacar la imagen del proceso
// del llamador (ADR-003, ADR-011).
//
// El paquete no empaqueta modelos: expone el verificador, el catálogo y las
// herramientas para traerlos y comprobarlos. Los umbrales están versionados y
// solo cambian con evidencia de evaluación archivada.

export { THRESHOLDS, THRESHOLDS_VERSION, type Thresholds } from "./thresholds.js";
export {
  createTwoTierVerifier,
  type Gate,
  type SecondOpinion,
  type TwoTierOptions,
} from "./verifier.js";
export { createClipGate, LOCAL_MODEL_ID, SIGNATURE_PROMPTS, type ClipGateOptions } from "./gate.js";
export { MODELS, modelsDir, type ModelFile, type ModelSpec } from "./models.js";
export {
  checkModels,
  pullModels,
  removeFile,
  type DoctorReport,
  type FetchLike,
  type PullReport,
} from "./pull.js";
