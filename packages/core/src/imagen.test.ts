import { describe, expect, it } from "vitest";

import { scaleToWidth } from "./imagen.js";

// Imagen de dos bloques: mitad izquierda negra, mitad derecha blanca.
function mitades(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = x < w / 2 ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe("scaleToWidth", () => {
  it("reduce conservando la proporción", () => {
    const res = scaleToWidth(mitades(100, 50), 50);
    expect(res.width).toBe(50);
    expect(res.height).toBe(25);
  });

  it("no agranda una imagen que ya cabe", () => {
    const original = mitades(100, 50);
    const res = scaleToWidth(original, 900);
    expect(res.width).toBe(100);
    expect(res.height).toBe(50);
    expect(res.data).toBe(original.data);
  });

  it("promedia el bloque en vez de descartar píxeles", () => {
    // 4x2 -> 2x1: cada píxel de salida es la media de su bloque 2x2.
    const res = scaleToWidth(mitades(4, 2), 2);
    expect(res.width).toBe(2);
    expect(res.height).toBe(1);
    expect(res.data[0]).toBe(0);
    expect(res.data[4]).toBe(255);
    expect(res.data[3]).toBe(255);
    expect(res.data[7]).toBe(255);
  });

  it("siempre deja el PNG opaco y con el mismo tamaño de buffer", () => {
    const res = scaleToWidth(mitades(37, 23), 11);
    expect(res.data.length).toBe(res.width * res.height * 4);
    for (let i = 3; i < res.data.length; i += 4) expect(res.data[i]).toBe(255);
  });
});
