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
    id: "siglip-base-patch16-224",
    tier: 1,
    // SigLIP está entrenado y publicado por Google bajo Apache-2.0; los ONNX
    // vienen del port de Xenova, que conserva la licencia del modelo original.
    licence: "Apache-2.0",
    files: [
      // Los cuatro ficheros que transformers.js necesita para preprocesar imagen
      // y texto.
      {
        name: "siglip-base-patch16-224/config.json",
        url: "https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/config.json",
        bytes: 457,
        sha256:
          "e6de71291f181b0b81adc93098787bb4597a79dc18f59737feda8f41671fb6a2",
      },
      {
        name: "siglip-base-patch16-224/preprocessor_config.json",
        url: "https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/preprocessor_config.json",
        bytes: 368,
        sha256:
          "21ee046a8a52a65e5f9c177bf840bfb39ea66c9c54cf2760630efd58e0a3ec80",
      },
      {
        name: "siglip-base-patch16-224/tokenizer.json",
        url: "https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/tokenizer.json",
        bytes: 2_398_744,
        sha256:
          "4a17c975210be5ab4c36b47d8dae4eefb866dbfb1e676e394aad85dc30a3ae08",
      },
      {
        name: "siglip-base-patch16-224/tokenizer_config.json",
        url: "https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/tokenizer_config.json",
        bytes: 739,
        sha256:
          "9a38d3c6b5e26fe5dcc607eda95e38d78d30d9291835bb9e8116e8174c1d4ba2",
      },
      {
        // Modelo fusionado (visión + texto en un solo grafo), que es como lo carga
        // el pipeline de zero-shot. Cuantizado q8: 201 MB.
        name: "siglip-base-patch16-224/onnx/model_quantized.onnx",
        url: "https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/onnx/model_quantized.onnx",
        bytes: 210_977_441,
        sha256:
          "9171eb00c38b9ec82f924877356d008b79e3285dbac7cd10965827bee30c9a99",
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
        name: "smolvlm-256m/SmolVLM-256M-Instruct-Q8_0.gguf",
        url: "https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF/resolve/main/SmolVLM-256M-Instruct-Q8_0.gguf",
        bytes: 175_054_528,
        sha256:
          "2a31195d3769c0b0fd0a4906201666108834848db768af11de1d2cef7cd35e65",
      },
      {
        name: "smolvlm-256m/mmproj-SmolVLM-256M-Instruct-Q8_0.gguf",
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
