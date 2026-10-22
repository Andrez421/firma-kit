// Catálogo de modelos. No se empaquetan: se descargan y se verifican por hash.
//
// `sha256: null` significa "todavía no fijado". `pullModels` se niega a bajar un
// archivo sin hash salvo que el llamador lo pida explícitamente, para que nadie
// acabe con pesos sin procedencia comprobable por accidente.

export type ModelFile = {
  name: string;
  url: string;
  bytes: number;
  /** SHA-256 del archivo, o null si aún no se fijó. */
  sha256: string | null;
};

export type ModelSpec = {
  id: string;
  tier: 1 | 2;
  licence: string;
  files: ModelFile[];
};

export const MODELS: ModelSpec[] = [
  {
    id: "mobileclip-s0-int8",
    tier: 1,
    licence: "Apple Sample Code License (MobileCLIP)",
    files: [
      {
        name: "vision_model_int8.onnx",
        url: "https://huggingface.co/Xenova/mobileclip_s0/resolve/main/onnx/vision_model_int8.onnx",
        bytes: 11_800_000,
        sha256:
          "7a1b45f57fb9f3cde9d325759883e9451d7281336caeb9c576ae918e72080f0b",
      },
      {
        name: "text_model_int8.onnx",
        url: "https://huggingface.co/Xenova/mobileclip_s0/resolve/main/onnx/text_model_int8.onnx",
        bytes: 42_800_000,
        sha256: null,
      },
    ],
  },
  {
    id: "smolvlm-256m-q4",
    tier: 2,
    licence: "Apache-2.0",
    files: [
      {
        name: "SmolVLM-256M-Instruct-Q4_K_M.gguf",
        url: "https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF/resolve/main/SmolVLM-256M-Instruct-Q4_K_M.gguf",
        bytes: 119_300_000,
        sha256: null,
      },
      {
        name: "mmproj-SmolVLM-256M-Instruct-Q8_0.gguf",
        url: "https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF/resolve/main/mmproj-SmolVLM-256M-Instruct-Q8_0.gguf",
        bytes: 104_000_000,
        sha256: null,
      },
    ],
  },
];

/** Directorio de caché: volumen del despliegue, nunca el paquete. */
export function modelsDir(entorno: NodeJS.ProcessEnv = process.env): string {
  return entorno["FIRMA_KIT_MODULES_DIR"] ?? "./modules";
}
