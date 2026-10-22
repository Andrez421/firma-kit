// Línea base sin modelos: el pipeline de tinta que ya corre en producción.
//
// No es el gate de fase 3 ni lo pretende. Sirve para una pregunta concreta y
// útil: de un corpus de negativos, ¿cuántos aceptaría hoy el pipeline como
// firma? Ese número es el suelo que el gate tiene que batir.

import { extractSignature, type Bitmap, type Verdict, type Verifier } from "@firma-kit/core";

export function createInkPipelineVerifier(): Verifier {
  return {
    async verify(image: Bitmap): Promise<Verdict> {
      const resultado = extractSignature(image.data, image.width, image.height);
      return {
        isSignature: resultado.ok,
        // El pipeline decide, no puntúa: se reporta certeza binaria en vez de
        // inventar una probabilidad que nadie calibró.
        confidence: resultado.ok ? 1 : 0,
        tier: 1,
      };
    },
  };
}
