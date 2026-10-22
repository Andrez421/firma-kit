// Gate de nivel 1: zero-shot imagen↔texto con SigLIP base (q8).
//
// Se pregunta lo que importa —«¿esto es una firma?»— comparando la imagen con un
// puñado de descripciones y quedándose con la probabilidad de la primera. Sin
// entrenar nada y sin sacar la imagen del proceso.
//
// Por qué SigLIP y no MobileCLIP: medido sobre cuatro fotos reales de firmas y
// 47 negativas, MobileCLIP-S0 reconocía 0 de 4 y su versión S1 ordenaba las
// firmas por debajo de los documentos. SigLIP reconoce 3 de 4 y rechaza 38 de 47.
// Ver docs/eval/gate-smoke.md y la enmienda de ADR-003.

import { env, pipeline, RawImage } from "@huggingface/transformers";
import type { Bitmap } from "@firma-kit/core";

import type { Gate } from "./verifier.js";

/**
 * Clases abiertas del gate. La primera es la que decide.
 *
 * Redactadas como descripciones de foto («a handwritten signature on paper») y
 * no como etiquetas sueltas: el modelo está entrenado con pies de foto.
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
export const LOCAL_MODEL_ID = "siglip-base-patch16-224";

export type ZeroShotGateOptions = {
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
 * falla con un error claro en vez de bajar 200 MB dentro de la petición de una
 * persona.
 */
export async function createZeroShotGate(options: ZeroShotGateOptions): Promise<Gate> {
  const { modelsDir, prompts = SIGNATURE_PROMPTS } = options;

  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = modelsDir;

  const clasificador = await pipeline("zero-shot-image-classification", LOCAL_MODEL_ID, {
    dtype: "q8",
  });

  const firma = prompts[0]!;

  return {
    async score(imagen: Bitmap): Promise<number> {
      const salida = (await clasificador(aRawImage(imagen), [...prompts])) as Array<{
        label: string;
        score: number;
      }>;
      const maxima = Math.max(...salida.map((clase) => clase.score));
      const propia = salida.find((clase) => clase.label === firma)?.score ?? 0;
      // Puntuación RELATIVA, no probabilidad absoluta: las probabilidades de un
      // zero-shot no están calibradas (una firma real saca 0.13-0.33 aunque gane),
      // así que lo que tiene señal es el orden. 1 significa «la firma es la clase
      // ganadora»; 0.5, «va segunda por la mitad».
      return maxima > 0 ? propia / maxima : 0;
    },
  };
}
