// Gate de nivel 1: zero-shot imagen↔texto con MobileCLIP-S0 int8.
//
// Se pregunta directamente lo que importa —«¿esto es una firma?»— comparando la
// imagen con un puñado de descripciones y quedándose con la probabilidad de la
// primera. Sin entrenar nada y sin sacar la imagen del proceso.

import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from "@huggingface/transformers";
import type { Bitmap } from "@firma-kit/core";

import type { Gate } from "./verifier.js";

/**
 * Clases abiertas del gate. La primera es la que decide.
 *
 * Redactadas como descripciones de foto («a photo of…») y no como etiquetas
 * sueltas: el modelo está entrenado con pies de foto, y la forma del texto mueve
 * el resultado más de lo que parece.
 */
export const SIGNATURE_PROMPTS = [
  "a handwritten signature on paper",
  "an identity document or ID card",
  "an invoice or printed page with text",
  "a photo of an object",
  "a screenshot of a screen",
  "a person",
] as const;

/** Carpeta del modelo dentro del volumen de modelos. */
export const LOCAL_MODEL_ID = "mobileclip-s0";

export type ClipGateOptions = {
  /** Directorio donde `firma-kit-verify models pull` dejó el modelo. */
  modelsDir: string;
  prompts?: readonly string[];
};

function aRawImage(imagen: Bitmap): RawImage {
  const n = imagen.width * imagen.height;
  const rgb = new Uint8ClampedArray(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const k = i * 4;
    rgb[j] = imagen.data[k]!;
    rgb[j + 1] = imagen.data[k + 1]!;
    rgb[j + 2] = imagen.data[k + 2]!;
  }
  return new RawImage(rgb, imagen.width, imagen.height, 3);
}

/**
 * Carga el modelo desde el volumen local y devuelve el gate.
 *
 * `allowRemoteModels = false` es deliberado: si el modelo no está descargado, se
 * falla con un error claro en vez de bajar 55 MB dentro de la petición de una
 * persona.
 */
export async function createClipGate(options: ClipGateOptions): Promise<Gate> {
  const { modelsDir, prompts = SIGNATURE_PROMPTS } = options;

  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = modelsDir;

  const [vision, text, processor, tokenizer] = await Promise.all([
    CLIPVisionModelWithProjection.from_pretrained(LOCAL_MODEL_ID, { dtype: "int8" }),
    CLIPTextModelWithProjection.from_pretrained(LOCAL_MODEL_ID, { dtype: "int8" }),
    AutoProcessor.from_pretrained(LOCAL_MODEL_ID),
    AutoTokenizer.from_pretrained(LOCAL_MODEL_ID),
  ]);

  // El export int8 del modelo exige longitud fija de 77: sin el padding explícito
  // ONNX falla intentando difundir 10 posiciones contra 77.
  const texto = await text(
    tokenizer([...prompts], { padding: "max_length", max_length: 77, truncation: true })
  );
  const dimension = texto.text_embeds.dims[1]!;
  const textoData = Array.from(texto.text_embeds.data as Float32Array);
  const normas = prompts.map((_, i) =>
    Math.hypot(...textoData.slice(i * dimension, (i + 1) * dimension))
  );

  const similitud = (imagen: Float32Array, i: number): number => {
    const normaImagen = Math.hypot(...imagen);
    let punto = 0;
    for (let k = 0; k < dimension; k++) {
      punto += imagen[k]! * textoData[i * dimension + k]!;
    }
    return punto / (normaImagen * normas[i]!);
  };

  return {
    async score(imagen: Bitmap): Promise<number> {
      const { pixel_values } = await processor(aRawImage(imagen));
      const { image_embeds } = await vision({ pixel_values });
      const datos = image_embeds.data as Float32Array;

      const sims = prompts.map((_, i) => similitud(datos, i));
      // El factor 100 es el `logit_scale` de CLIP: sin él, el softmax de cosenos
      // queda casi plano y ninguna clase gana.
      const exp = sims.map((s) => Math.exp(s * 100));
      const suma = exp.reduce((a, b) => a + b, 0);
      return exp[0]! / suma;
    },
  };
}
