import { existsSync } from "node:fs";
import path from "node:path";

import type { Bitmap } from "@firma-kit/core";
import { describe, expect, it } from "vitest";

import { createZeroShotGate, LOCAL_MODEL_ID, SIGNATURE_PROMPTS } from "./gate.js";

const modelos = process.env["FIRMA_KIT_MODULES_DIR"] ?? path.join(process.cwd(), "modules");
const hayModelo = existsSync(path.join(modelos, LOCAL_MODEL_ID, "onnx", "model_quantized.onnx"));

/** Lienzo blanco con una banda oscura: sirve para comprobar que el gate corre. */
function imagen(w = 320, h = 240): Bitmap {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 90; y < 150; y++) {
    for (let x = 40; x < 280; x++) {
      const i = (y * w + x) * 4;
      data[i] = 20;
      data[i + 1] = 20;
      data[i + 2] = 20;
    }
  }
  return { data, width: w, height: h };
}

describe("createZeroShotGate", () => {
  it("pregunta por la firma primero y por cinco clases más después", () => {
    expect(SIGNATURE_PROMPTS[0]).toMatch(/signature/);
    // Diez clases: las seis originales más cuatro de interfaz que impiden que una
    // captura de pantalla del propio campo pase por firma.
    expect(SIGNATURE_PROMPTS).toHaveLength(10);
  });

  // Sin los pesos no hay nada que medir: el test se salta en vez de fingir. En CI
  // los modelos no están; en local, tras `firma-kit-verify models pull`, sí.
  it.skipIf(!hayModelo)(
    "devuelve una probabilidad entre 0 y 1 con el modelo local",
    async () => {
      const gate = await createZeroShotGate({ modelsDir: modelos });
      const puntaje = await gate.score(imagen());
      expect(puntaje).toBeGreaterThanOrEqual(0);
      expect(puntaje).toBeLessThanOrEqual(1);
    },
    120_000
  );
});

describe("clases del gate", () => {
  it("la primera clase es la firma: es la que decide la puntuación", () => {
    expect(SIGNATURE_PROMPTS[0]).toBe("a handwritten signature on paper");
  });

  it("incluye clases de interfaz, no solo «una captura de pantalla»", () => {
    // La captura del propio campo se colaba como firma con la clase genérica; estas
    // la bajan de 1.00 a 0.23 según la medición del corpus.
    expect(SIGNATURE_PROMPTS.some((p) => p.includes("buttons and tabs"))).toBe(true);
    expect(SIGNATURE_PROMPTS.some((p) => p.includes("user interface"))).toBe(true);
    expect(SIGNATURE_PROMPTS.some((p) => p.includes("screen capture"))).toBe(true);
    expect(SIGNATURE_PROMPTS.some((p) => p.includes("signature box"))).toBe(true);
  });
});
