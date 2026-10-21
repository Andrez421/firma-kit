import { describe, expect, it } from "vitest";

import { createCanvasPngEncoder } from "./encoder.js";

const bitmap = {
  data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
  width: 4,
  height: 4,
};

describe("createCanvasPngEncoder", () => {
  it("rechaza la promesa cuando no hay contexto 2D", async () => {
    // jsdom no implementa canvas: es el mismo caso que un navegador con canvas
    // bloqueado. Nunca se devuelve un PNG que no se codificó.
    const encoder = createCanvasPngEncoder(() => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }) as unknown as HTMLCanvasElement);
    await expect(encoder(bitmap)).rejects.toThrow();
  });
});
