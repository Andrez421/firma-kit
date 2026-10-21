import { describe, expect, it } from "vitest";

import { createCanvasPngEncoder, toPngBlob } from "./encoder.js";

const bitmap = {
  data: new Uint8ClampedArray(4 * 4 * 4).fill(255),
  width: 4,
  height: 4,
};

describe("toPngBlob", () => {
  it("envuelve los bytes en un PNG con su tipo MIME", async () => {
    const blob = toPngBlob({ png: new Uint8Array([1, 2, 3]) });
    expect(blob.type).toBe("image/png");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });
});

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
