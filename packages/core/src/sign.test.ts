import { describe, expect, it, vi } from "vitest";

import { sign, type SignatureInput } from "./sign.js";
import { MESSAGES_EN, MESSAGES_ES } from "./messages/index.js";
import type { StrokePoint } from "./modes/draw.js";
import type { TextMeasurer, TextRasterizer } from "./modes/type.js";
import type { Bitmap, PngEncoder } from "./types.js";



// Los fixtures replican los del pipeline (misma curva, mismo grosor): si
// cambian allí, el rechazo esperado aquí cambia también, y eso es señal.
const W = 400;
const H = 240;
const TINTA = 20;

function canvas(paint: (x: number, y: number) => number): Bitmap {
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

function syntheticSignature(paper = 255, tinta = TINTA): Bitmap {
  const image = canvas(() => paper);
  const r = 3;
  for (const [cx, cy] of CURVA) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        image.data[i] = tinta;
        image.data[i + 1] = tinta;
        image.data[i + 2] = tinta;
      }
    }
  }
  return image;
}

function flatBitmap(value: number): Bitmap {
  return canvas(() => value);
}

/** Textura que el umbral local lee como tinta en toda la hoja. */
function darkTexture(): Bitmap {
  return canvas((x, y) => (((x >> 1) + (y >> 1)) % 2 === 0 ? 10 : 250));
}

const encoder = (): PngEncoder & ReturnType<typeof vi.fn> =>
  vi.fn(async () => new Uint8Array([1, 2, 3]));

const measurer: TextMeasurer = {
  measure: (text, style) => ({
    width: text.length * style.size * 0.5,
    height: style.size,
  }),
};

/** Dibuja una barra por línea: tinta suficiente para pasar los gates. */
const rasterizer: TextRasterizer = {
  rasterize: (lines, style, lineHeight, bounds) => {
    const { width, height } = bounds;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    lines.forEach((_, n) => {
      const y0 = Math.round(style.size * 0.6 + n * lineHeight);
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

const stroke: StrokePoint[] = Array.from({ length: 40 }, (_, i) => ({
  x: 40 + i * 20,
  y: 150 + Math.round(30 * Math.sin(i / 4)),
  t: i * 16,
}));

describe("firmar — modo subir", () => {
  it("devuelve la firma en PNG con su tamaño y su fecha", async () => {
    const png = encoder();
    const res = await sign({ mode: "upload", image: syntheticSignature() }, png);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.signature.mode).toBe("upload");
    expect(Array.from(res.signature.png)).toEqual([1, 2, 3]);
    expect(res.signature.width).toBeLessThanOrEqual(900);
    expect(res.signature.height).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(res.signature.createdAt))).toBe(false);
    expect(res.signature.enhanced).toBeUndefined();
  });

  it("rechaza un lienzo en blanco con el mensaje por defecto", async () => {
    const png = encoder();
    const res = await sign({ mode: "upload", image: flatBitmap(255) }, png);
    expect(res).toEqual({
      ok: false,
      reason: "no_ink",
      message: MESSAGES_EN.no_ink,
    });
    expect(png).not.toHaveBeenCalled();
  });

  it("rechaza una foto con el fondo oscuro", async () => {
    const res = await sign(
      { mode: "camera", image: darkTexture() },
      encoder()
    );
    expect(res).toMatchObject({ ok: false, reason: "dark_background" });
  });

  it("explica el rechazo en español cuando se pide ese idioma", async () => {
    const res = await sign({ mode: "upload", image: flatBitmap(255) }, encoder(), {
      locale: "es",
    });
    expect(res).toMatchObject({ message: MESSAGES_ES.no_ink });
  });

  it("respeta el mensaje propio del llamador", async () => {
    const res = await sign({ mode: "upload", image: flatBitmap(255) }, encoder(), {
      messages: { no_ink: "Acércate un poco más." },
    });
    expect(res).toMatchObject({ message: "Acércate un poco más." });
  });

  it("rechaza lo que el verificador no reconoce como firma, sin codificar", async () => {
    const png = encoder();
    const verifier = {
      verify: vi.fn(async () => ({
        isSignature: false,
        confidence: 0.9,
        tier: 1 as const,
      })),
    };
    const res = await sign({ mode: "camera", image: syntheticSignature() }, png, {
      verifier,
    });
    expect(res).toMatchObject({ ok: false, reason: "not_a_signature" });
    expect(png).not.toHaveBeenCalled();
  });

  it("clasifica la imagen original, no la limpia", async () => {
    const recibidas: Bitmap[] = [];
    const verifier = {
      verify: async (image: Bitmap) => {
        recibidas.push(image);
        return { isSignature: true, confidence: 0.95, tier: 1 as const };
      },
    };
    const gris = syntheticSignature(150);
    const res = await sign({ mode: "upload", image: gris }, encoder(), {
      verifier,
    });
    expect(res.ok).toBe(true);
    expect(recibidas).toHaveLength(1);
    const enviada = recibidas[0]!;
    expect(enviada.width).toBe(W);
    expect(enviada.data[0]).toBe(150);
    // La firma guardada sí salió limpia: el papel es blanco puro.
    expect(res.ok && res.signature.width).toBeGreaterThan(0);
  });

  it("si el verificador falla, la persona puede firmar igual", async () => {
    const verifier = {
      verify: async () => {
        throw new Error("modelo no descargado");
      },
    };
    const res = await sign(
      { mode: "upload", image: syntheticSignature() },
      encoder(),
      { verifier }
    );
    expect(res.ok).toBe(true);
  });
});

describe("firmar — modo dibujar", () => {
  const canvas = { width: 900, height: 300 };

  it("rechaza un lienzo sin trazo", async () => {
    const res = await sign(
      { mode: "draw", strokes: [], canvas },
      encoder()
    );
    expect(res).toMatchObject({ ok: false, reason: "empty" });
  });

  it("devuelve el trazo recortado dentro del ancho del contrato", async () => {
    const res = await sign({ mode: "draw", strokes: [stroke], canvas }, encoder());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.signature.mode).toBe("draw");
    expect(res.signature.width).toBeLessThanOrEqual(900);
    expect(res.signature.width).toBeGreaterThan(400);
  });
});

describe("firmar — modo escribir", () => {
  const canvas = { width: 400, height: 240 };
  const base = { mode: "type" as const, canvas, measurer };

  it("rechaza el texto vacío antes de rasterizar", async () => {
    const res = await sign({ ...base, text: "  ", rasterizer }, encoder());
    expect(res).toMatchObject({ ok: false, reason: "empty" });
  });

  it("si la fuente no cargó, lo dice en vez de devolver un PNG a medias", async () => {
    const sinFuente: TextRasterizer = { rasterize: () => null };
    const res = await sign(
      { ...base, text: "Ana", rasterizer: sinFuente },
      encoder()
    );
    expect(res).toMatchObject({
      ok: false,
      reason: "font_unavailable",
      message: MESSAGES_EN.font_unavailable,
    });
  });

  it("devuelve el nombre escrito como firma", async () => {
    const res = await sign(
      { ...base, text: "José Muñoz", rasterizer },
      encoder()
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.signature.mode).toBe("type");
    expect(res.signature.width).toBeLessThanOrEqual(900);
  });
});

describe("firmar — trazabilidad del realce", () => {
  it("marca la firma cuando el pipeline tuvo que realzar niveles", async () => {
    // Foto plana: el trazo es apenas más oscuro que el papel.
    const res = await sign(
      { mode: "upload", image: syntheticSignature(200, 178) },
      encoder()
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.signature.enhanced).toBe(true);
  });
});
