// Medida y pintado de texto del navegador: la implementación del puerto
// `TextRasterizer` y del medidor que `core` usa para decidir el layout.
//
// El texto se pinta con `fillText` sobre un canvas propio, nunca con
// `html-to-image`: una imagen de texto no necesita el DOM entero.

import type { Bitmap } from "@firma-kit/core";
import type {
  EstiloTexto,
  MedidorTexto,
  TextRasterizer,
} from "@firma-kit/core";

type Lienzo = HTMLCanvasElement | OffscreenCanvas;

function crearLienzo(width: number, height: number): Lienzo {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** La familia declarada en `assets/fonts.css`, con una cursiva del sistema de reserva. */
export function familiaFont(familia: string): string {
  return `"${familia}", "Segoe Script", "Brush Script MT", cursive`;
}

/**
 * Pide al navegador que cargue la cursiva antes de medir. Sin esto, la primera
 * medida usa la fuente de reserva y el nombre se sale de la caja.
 */
export async function cargarFuente(familia: string, tamano: number): Promise<void> {
  const fonts = (globalThis as { document?: Document }).document?.fonts;
  if (!fonts) return;
  try {
    await fonts.load(`${tamano}px "${familia}"`);
  } catch {
    // Si la fuente no está, el rasterizador devolverá null y el motivo será
    // `fuente_no_disponible`; aquí no hay nada que decidir.
  }
}

export function createCanvasTextMeasurer(
  crear?: (width: number, height: number) => Lienzo
): MedidorTexto {
  const fabricar = crear ?? crearLienzo;
  return {
    medir(texto: string, estilo: EstiloTexto) {
      const lienzo = fabricar(8, 8);
      const ctx = lienzo.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return { ancho: texto.length * estilo.tamano * 0.5, alto: estilo.tamano };
      ctx.font = `${estilo.tamano}px ${familiaFont(estilo.familia)}`;
      return { ancho: ctx.measureText(texto).width, alto: estilo.tamano };
    },
  };
}

export function createCanvasTextRasterizer(
  crear?: (width: number, height: number) => Lienzo
): TextRasterizer {
  const fabricar = crear ?? crearLienzo;
  return {
    rasterizar(lineas, estilo, interlineado, caja): Bitmap | null {
      const lienzo = fabricar(caja.width, caja.height);
      lienzo.width = caja.width;
      lienzo.height = caja.height;
      const ctx = lienzo.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, caja.width, caja.height);
      ctx.fillStyle = "#000000";
      ctx.font = `${estilo.tamano}px ${familiaFont(estilo.familia)}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      lineas.forEach((linea, i) => {
        const y = estilo.tamano + i * interlineado;
        ctx.fillText(linea, caja.width / 2, y);
      });
      const datos = ctx.getImageData(0, 0, caja.width, caja.height);
      return { data: datos.data, width: caja.width, height: caja.height };
    },
  };
}
