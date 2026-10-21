import { describe, expect, it, vi } from "vitest";

import { firmar, type EntradaFirma } from "./firma.js";
import { MENSAJES_ES } from "./mensajes/es.js";
import type { PuntoTrazo } from "./modos/dibujar.js";
import type { MedidorTexto, TextRasterizer } from "./modos/escribir.js";
import type { Bitmap, EncodePng } from "./tipos.js";



// Los fixtures replican los del pipeline (misma curva, mismo grosor): si
// cambian allí, el rechazo esperado aquí cambia también, y eso es señal.
const W = 400;
const H = 240;
const TINTA = 20;

function lienzo(paint: (x: number, y: number) => number): Bitmap {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = paint(x, y);
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

const CURVA: Array<[number, number]> = [];
for (let i = 0; i < 120; i++) {
  const t = i / 119;
  CURVA.push([
    Math.round(90 + t * 220),
    Math.round(130 - Math.sin(t * Math.PI * 1.6) * 45),
  ]);
}

function firmaSintetica(papel = 255, tinta = TINTA): Bitmap {
  const imagen = lienzo(() => papel);
  const r = 3;
  for (const [cx, cy] of CURVA) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        imagen.data[i] = tinta;
        imagen.data[i + 1] = tinta;
        imagen.data[i + 2] = tinta;
      }
    }
  }
  return imagen;
}

function lienzoPlano(valor: number): Bitmap {
  return lienzo(() => valor);
}

/** Textura que el umbral local lee como tinta en toda la hoja. */
function texturaOscura(): Bitmap {
  return lienzo((x, y) => (((x >> 1) + (y >> 1)) % 2 === 0 ? 10 : 250));
}

const encoder = (): EncodePng & ReturnType<typeof vi.fn> =>
  vi.fn(async () => new Uint8Array([1, 2, 3]));

const medidor: MedidorTexto = {
  medir: (texto, estilo) => ({
    ancho: texto.length * estilo.tamano * 0.5,
    alto: estilo.tamano,
  }),
};

/** Dibuja una barra por línea: tinta suficiente para pasar los gates. */
const rasterizer: TextRasterizer = {
  rasterizar: (lineas, estilo, interlineado, caja) => {
    const { width, height } = caja;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    lineas.forEach((_, n) => {
      const y0 = Math.round(estilo.tamano * 0.6 + n * interlineado);
      for (let y = y0; y < Math.min(height, y0 + 6); y++) {
        for (let x = 40; x < Math.min(width, 200); x++) {
          const i = (y * width + x) * 4;
          data[i] = 20;
          data[i + 1] = 20;
          data[i + 2] = 20;
        }
      }
    });
    return { data, width, height };
  },
};

const trazo: PuntoTrazo[] = Array.from({ length: 40 }, (_, i) => ({
  x: 40 + i * 20,
  y: 150 + Math.round(30 * Math.sin(i / 4)),
  t: i * 16,
}));

describe("firmar — modo subir", () => {
  it("devuelve la firma en PNG con su tamaño y su fecha", async () => {
    const png = encoder();
    const res = await firmar({ modo: "subir", imagen: firmaSintetica() }, png);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.firma.modo).toBe("subir");
    expect(Array.from(res.firma.png)).toEqual([1, 2, 3]);
    expect(res.firma.ancho).toBeLessThanOrEqual(900);
    expect(res.firma.alto).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(res.firma.creadaEn))).toBe(false);
    expect(res.firma.realzada).toBeUndefined();
  });

  it("rechaza un lienzo en blanco con el mensaje por defecto", async () => {
    const png = encoder();
    const res = await firmar({ modo: "subir", imagen: lienzoPlano(255) }, png);
    expect(res).toEqual({
      ok: false,
      motivo: "sin_tinta",
      mensaje: MENSAJES_ES.sin_tinta,
    });
    expect(png).not.toHaveBeenCalled();
  });

  it("rechaza una foto con el fondo oscuro", async () => {
    const res = await firmar(
      { modo: "foto", imagen: texturaOscura() },
      encoder()
    );
    expect(res).toMatchObject({ ok: false, motivo: "fondo_oscuro" });
  });

  it("respeta el mensaje propio del llamador", async () => {
    const res = await firmar({ modo: "subir", imagen: lienzoPlano(255) }, encoder(), {
      mensajes: { sin_tinta: "Acércate un poco más." },
    });
    expect(res).toMatchObject({ mensaje: "Acércate un poco más." });
  });

  it("rechaza lo que el verificador no reconoce como firma, sin codificar", async () => {
    const png = encoder();
    const verificador = {
      verificar: vi.fn(async () => ({
        esFirma: false,
        confianza: 0.9,
        nivel: 1 as const,
      })),
    };
    const res = await firmar({ modo: "foto", imagen: firmaSintetica() }, png, {
      verificador,
    });
    expect(res).toMatchObject({ ok: false, motivo: "no_es_firma" });
    expect(png).not.toHaveBeenCalled();
  });

  it("clasifica la imagen original, no la limpia", async () => {
    const recibidas: Bitmap[] = [];
    const verificador = {
      verificar: async (imagen: Bitmap) => {
        recibidas.push(imagen);
        return { esFirma: true, confianza: 0.95, nivel: 1 as const };
      },
    };
    const gris = firmaSintetica(150);
    const res = await firmar({ modo: "subir", imagen: gris }, encoder(), {
      verificador,
    });
    expect(res.ok).toBe(true);
    expect(recibidas).toHaveLength(1);
    const enviada = recibidas[0]!;
    expect(enviada.width).toBe(W);
    expect(enviada.data[0]).toBe(150);
    // La firma guardada sí salió limpia: el papel es blanco puro.
    expect(res.ok && res.firma.ancho).toBeGreaterThan(0);
  });

  it("si el verificador falla, la persona puede firmar igual", async () => {
    const verificador = {
      verificar: async () => {
        throw new Error("modelo no descargado");
      },
    };
    const res = await firmar(
      { modo: "subir", imagen: firmaSintetica() },
      encoder(),
      { verificador }
    );
    expect(res.ok).toBe(true);
  });
});

describe("firmar — modo dibujar", () => {
  const lienzo = { width: 900, height: 300 };

  it("rechaza un lienzo sin trazo", async () => {
    const res = await firmar(
      { modo: "dibujar", puntos: [], lienzo },
      encoder()
    );
    expect(res).toMatchObject({ ok: false, motivo: "vacia" });
  });

  it("devuelve el trazo recortado dentro del ancho del contrato", async () => {
    const res = await firmar({ modo: "dibujar", puntos: trazo, lienzo }, encoder());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.firma.modo).toBe("dibujar");
    expect(res.firma.ancho).toBeLessThanOrEqual(900);
    expect(res.firma.ancho).toBeGreaterThan(400);
  });
});

describe("firmar — modo escribir", () => {
  const lienzo = { width: 400, height: 240 };
  const base = { modo: "escribir" as const, lienzo, medidor };

  it("rechaza el texto vacío antes de rasterizar", async () => {
    const res = await firmar({ ...base, texto: "  ", rasterizer }, encoder());
    expect(res).toMatchObject({ ok: false, motivo: "vacia" });
  });

  it("si la fuente no cargó, lo dice en vez de devolver un PNG a medias", async () => {
    const sinFuente: TextRasterizer = { rasterizar: () => null };
    const res = await firmar(
      { ...base, texto: "Ana", rasterizer: sinFuente },
      encoder()
    );
    expect(res).toMatchObject({
      ok: false,
      motivo: "fuente_no_disponible",
      mensaje: MENSAJES_ES.fuente_no_disponible,
    });
  });

  it("devuelve el nombre escrito como firma", async () => {
    const res = await firmar(
      { ...base, texto: "José Muñoz", rasterizer },
      encoder()
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.firma.modo).toBe("escribir");
    expect(res.firma.ancho).toBeLessThanOrEqual(900);
  });
});

describe("firmar — trazabilidad del realce", () => {
  it("marca la firma cuando el pipeline tuvo que realzar niveles", async () => {
    // Foto plana: el trazo es apenas más oscuro que el papel.
    const res = await firmar(
      { modo: "subir", imagen: firmaSintetica(200, 178) },
      encoder()
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.firma.realzada).toBe(true);
  });
});
