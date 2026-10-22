// Verificador de dos niveles sobre el puerto `Verifier` de `@firma-kit/core`.
//
// El paquete no trae modelos: recibe el gate y la segunda opinión como
// dependencias. Así se puede probar sin 400 MB y el consumidor decide cómo los
// carga (ONNX, GGUF, un servicio local, un doble en tests).

import type { Bitmap, Verdict, Verifier } from "@firma-kit/core";

import { THRESHOLDS, type Thresholds } from "./thresholds.js";

/** Nivel 1: probabilidad 0..1 de que la imagen sea una firma manuscrita. */
export type Gate = {
  score: (imagen: Bitmap) => Promise<number>;
};

/** Nivel 2: solo se invoca cuando el gate es ambiguo. */
export type SecondOpinion = {
  decide: (imagen: Bitmap) => Promise<{ isSignature: boolean; confidence: number }>;
};

export type TwoTierOptions = {
  gate: Gate;
  secondOpinion?: SecondOpinion;
  thresholds?: Thresholds;
};

export function createTwoTierVerifier(options: TwoTierOptions): Verifier {
  const { gate, secondOpinion, thresholds = THRESHOLDS } = options;

  if (thresholds.gateReject >= thresholds.gateAccept) {
    // Unos umbrales invertidos aceptarían y rechazarían a la vez; se detecta al
    // construir y no en la primera firma de una persona.
    throw new Error(
      `gateReject (${thresholds.gateReject}) debe ser menor que gateAccept (${thresholds.gateAccept})`
    );
  }

  return {
    async verify(image: Bitmap): Promise<Verdict> {
      const score = await gate.score(image);

      if (score >= thresholds.gateAccept) {
        return { isSignature: true, confidence: score, tier: 1 };
      }
      if (score <= thresholds.gateReject) {
        return { isSignature: false, confidence: 1 - score, tier: 1 };
      }

      // Ambiguo. Sin segunda opinión NO se rechaza: la métrica que no se negocia
      // son los falsos rechazos, así que un "quizá" se acepta y se queda como
      // evidencia con su confianza baja.
      if (!secondOpinion) {
        return { isSignature: true, confidence: score, tier: 1 };
      }

      const second = await secondOpinion.decide(image);
      return {
        isSignature: second.isSignature,
        confidence: second.confidence,
        tier: 2,
      };
    },
  };
}
