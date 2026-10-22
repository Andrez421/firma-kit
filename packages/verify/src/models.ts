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
    // El repositorio del modelo declara la licencia de Apple (apple-amlr), no
    // una Creative Commons: no es redistribuible, solo descargable.
    licence: "Apple Machine Learning Research Model License (apple-amlr)",
    files: [
      {
        name: "vision_model_int8.onnx",
        url: "https://huggingface.co/Xenova/mobileclip_s0/resolve/main/onnx/vision_model_int8.onnx",
        bytes: 11_846_808,
        sha256:
          "7a1b45f57fb9f3cde9d325759883e9451d7281336caeb9c576ae918e72080f0b",
      },
      {
        name: "text_model_int8.onnx",
        url: "https://huggingface.co/Xenova/mobileclip_s0/resolve/main/onnx/text_model_int8.onnx",
        bytes: 42_799_230,
        sha256:
          "fc8d87978623385c17a46331ffb9cb5ab7fe8b61c513c094602b85f08edd0a0b",
      },
    ],
  },
  {
    id: "smolvlm-256m-q8",
    tier: 2,
    licence: "Apache-2.0",
    files: [
      // Q8_0 y no Q4_K_M: el repositorio oficial (ggml-org) no publica Q4_K_M,
      // solo Q8_0 y f16. Se prefiere el repo oficial antes que un espejo de
      // terceros, y 167 MB siguen siendo razonables para una segunda opinión.
      {
        name: "SmolVLM-256M-Instruct-Q8_0.gguf",
        url: "https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF/resolve/main/SmolVLM-256M-Instruct-Q8_0.gguf",
        bytes: 175_054_528,
        sha256:
          "2a31195d3769c0b0fd0a4906201666108834848db768af11de1d2cef7cd35e65",
      },
      {
        name: "mmproj-SmolVLM-256M-Instruct-Q8_0.gguf",
        url: "https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF/resolve/main/mmproj-SmolVLM-256M-Instruct-Q8_0.gguf",
        bytes: 103_769_856,
        sha256:
          "7e943f7c53f0382a6fc41b6ee0c2def63ba4fded9ab8ed039cc9e2ab905e0edd",
      },
    ],
  },
];

/** Directorio de caché: volumen del despliegue, nunca el paquete. */
export function modelsDir(entorno: NodeJS.ProcessEnv = process.env): string {
  return entorno["FIRMA_KIT_MODULES_DIR"] ?? "./modules";
}
