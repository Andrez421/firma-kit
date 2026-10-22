// Medida y pintado de texto del navegador: la implementación del puerto
// `TextRasterizer` y del medidor que `core` usa para decidir el layout.
//
// El texto se pinta con `fillText` sobre un canvas propio, nunca con
// `html-to-image`: una imagen de texto no necesita el DOM entero.

import type { Bitmap } from "@firma-kit/core";
import type {
  TextStyle,
  TextMeasurer,
  TextRasterizer,
} from "@firma-kit/core";

type Lienzo = HTMLCanvasElement | OffscreenCanvas;

function createCanvas(width: number, height: number): Lienzo {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** La family declarada en `assets/fonts.css`, con una cursiva del sistema de reserva. */
export function fontFamily(family: string): string {
  return `"${family}", "Segoe Script", "Brush Script MT", cursive`;
}

/**
 * Pide al navegador que cargue la cursiva antes de medir. Sin esto, la primera
 * medida usa la fuente de reserva y el name se sale de la bounds.
 */
export async function loadFont(family: string, size: number): Promise<void> {
  const fonts = (globalThis as { document?: Document }).document?.fonts;
  if (!fonts) return;
  try {
    await fonts.load(`${size}px "${family}"`);
  } catch {
    // Si la fuente no está, el rasterizador devolverá null y el motivo será
    // `font_unavailable`; aquí no hay nada que decidir.
  }
}

export function createCanvasTextMeasurer(
  create?: (width: number, height: number) => Lienzo
): TextMeasurer {
  const factory = create ?? createCanvas;
  return {
    measure(text: string, style: TextStyle) {
      const canvas = factory(8, 8);
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return { width: text.length * style.size * 0.5, height: style.size };
      ctx.font = `${style.size}px ${fontFamily(style.family)}`;
      return { width: ctx.measureText(text).width, height: style.size };
    },
  };
}

export function createCanvasTextRasterizer(
  create?: (width: number, height: number) => Lienzo
): TextRasterizer {
  const factory = create ?? createCanvas;
  return {
    rasterize(lines, style, lineHeight, bounds): Bitmap | null {
      const canvas = factory(bounds.width, bounds.height);
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, bounds.width, bounds.height);
      ctx.fillStyle = "#000000";
      ctx.font = `${style.size}px ${fontFamily(style.family)}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      lines.forEach((linea, i) => {
        const y = style.size + i * lineHeight;
        ctx.fillText(linea, bounds.width / 2, y);
      });
      const data = ctx.getImageData(0, 0, bounds.width, bounds.height);
      return { data: data.data, width: bounds.width, height: bounds.height };
    },
  };
}
