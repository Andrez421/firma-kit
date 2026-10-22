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
    expect(SIGNATURE_PROMPTS).toHaveLength(6);
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
