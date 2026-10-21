import { describe, expect, it } from "vitest";

import { detectFormat } from "./format.js";

// Cabeceras reales, no inventadas: la firma PNG son 8 bytes fijos y JPEG
// empieza por el marcador SOI seguido de cualquier APPn.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

describe("detectarFormato", () => {
  it("reconoce PNG por su firma de 8 bytes", () => {
    expect(detectFormat(PNG)).toBe("png");
  });

  it("reconoce JPEG por su marcador de inicio de imagen", () => {
    expect(detectFormat(JPEG)).toBe("jpeg");
  });

  it("devuelve null para un formato que no es de imagen", () => {
    expect(detectFormat(PDF)).toBeNull();
  });

  it("devuelve null si la cabecera es más corta que la firma, sin lanzar", () => {
    expect(detectFormat(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(detectFormat(new Uint8Array([]))).toBeNull();
  });

  it("acepta el Uint8ClampedArray que entrega un FileReader", () => {
    expect(detectFormat(new Uint8ClampedArray(PNG))).toBe("png");
  });
});
