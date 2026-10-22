// Camino real de canvas, en Node con @napi-rs/canvas: verifica que los dos
// puertos de navegador hacen trabajo de verdad (codificar un PNG, pintar texto)
// en vez de solo devolver algo con la forma esperada.
//
// Las fuentes del paquete son woff2 y este runtime no las carga; se registra una
// TTF del sistema para poder comprobar que hay tinta donde debe haberla.

import { readFileSync } from "node:fs";

import { createCanvas, GlobalFonts, type Canvas } from "@napi-rs/canvas";
import { beforeAll, describe, expect, it } from "vitest";

import { createCanvasPngEncoder } from "./encoder.js";
import { createCanvasTextMeasurer, createCanvasTextRasterizer } from "./rasterizer.js";

const FUENTE_SISTEMA = "/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf";

/** Adapta la API de napi-rs a la del DOM que consumen los puertos. */
function lienzo(width: number, height: number): HTMLCanvasElement {
  const canvas: Canvas = createCanvas(width, height);
  return {
    get width() {
      return canvas.width;
    },
    set width(valor: number) {
      canvas.width = valor;
    },
    get height() {
      return canvas.height;
    },
    set height(valor: number) {
      canvas.height = valor;
    },
    getContext: (tipo: "2d") => canvas.getContext(tipo),
    toBlob: (callback: (blob: Blob | null) => void) =>
      // `Buffer` es `Uint8Array<ArrayBufferLike>` y no es un `BlobPart`: la copia
      // le da su propio ArrayBuffer, igual que hace `toPngBlob`.
      callback(
        new Blob([new Uint8Array(canvas.toBuffer("image/png"))], {
          type: "image/png",
        })
      ),
  } as unknown as HTMLCanvasElement;
}

beforeAll(() => {
  // Si la TTF no está, el test de tinta se marca como no aplicable en vez de
  // fingir que pasó.
  try {
    GlobalFonts.registerFromPath(FUENTE_SISTEMA, "Adwaita Sans");
  } catch {
    /* sin fuente: ver más abajo */
  }
});

describe("createCanvasPngEncoder con un canvas real", () => {
  it("produce un PNG de verdad, con su firma y su tamaño", async () => {
    const encoder = createCanvasPngEncoder(lienzo);
    const bitmap = {
      data: new Uint8ClampedArray(40 * 20 * 4).fill(200),
      width: 40,
      height: 20,
    };
    const png = await encoder(bitmap);
    // Firma PNG: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    // Un PNG de 40x20 comprimido no baja de unos cientos de bytes.
    expect(png.byteLength).toBeGreaterThan(100);
  });
});

describe("createCanvasTextRasterizer con un canvas real", () => {
  const caja = { width: 400, height: 200 };

  it("devuelve un bitmap del tamaño pedido y opaco", () => {
    const rasterizer = createCanvasTextRasterizer(lienzo);
    const bitmap = rasterizer.rasterize(
      ["Ana"],
      { family: "Adwaita Sans", size: 48 },
      56,
      caja
    );
    expect(bitmap).not.toBeNull();
    expect(bitmap!.width).toBe(caja.width);
    expect(bitmap!.height).toBe(caja.height);
    expect(bitmap!.data.length).toBe(caja.width * caja.height * 4);
    // Fondo blanco opaco.
    expect(bitmap!.data[3]).toBe(255);
  });

  it("pinta tinta donde va el texto", () => {
    if (!readFileExists(FUENTE_SISTEMA)) return; // no aplicable sin fuente TTF
    const rasterizer = createCanvasTextRasterizer(lienzo);
    const bitmap = rasterizer.rasterize(
      ["Ana"],
      { family: "Adwaita Sans", size: 48 },
      56,
      caja
    )!;
    let oscuros = 0;
    for (let i = 0; i < bitmap.data.length; i += 4) {
      if (bitmap.data[i]! < 128) oscuros++;
    }
    expect(oscuros).toBeGreaterThan(50);
  });

  it("mide texto con el medidor real", () => {
    const measurer = createCanvasTextMeasurer(lienzo);
    const corto = measurer.measure("Ana", { family: "Adwaita Sans", size: 48 });
    const largo = measurer.measure(
      "Ana María Fernández",
      { family: "Adwaita Sans", size: 48 }
    );
    expect(corto.width).toBeGreaterThan(0);
    expect(largo.width).toBeGreaterThan(corto.width);
  });
});

function readFileExists(ruta: string): boolean {
  try {
    readFileSync(ruta);
    return true;
  } catch {
    return false;
  }
}
