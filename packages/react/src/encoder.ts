// Codificador PNG del navegador: la implementación del puerto `EncodePng` que
// `core` no puede traer sin dejar de ser puro. Se mantiene aparte del componente
// para poder probarlo y sustituirlo.

import type { Bitmap, EncodePng } from "@firma-kit/core";

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

function aBlob(lienzo: Lienzo): Promise<Blob> {
  if ("convertToBlob" in lienzo) return lienzo.convertToBlob({ type: "image/png" });
  return new Promise((resolver, rechazar) => {
    lienzo.toBlob((blob) => {
      if (blob) resolver(blob);
      else rechazar(new Error("El navegador no pudo codificar el PNG."));
    }, "image/png");
  });
}

/**
 * Devuelve un `EncodePng` que dibuja el bitmap y lo codifica.
 *
 * Un navegador sin contexto 2D (un jsdom, un canvas bloqueado) no produce un
 * PNG falso: la promesa se rechaza, y el llamador lo convierte en un rechazo
 * explicable en vez de guardar una imagen que no existe.
 */
export function createCanvasPngEncoder(
  crear?: (width: number, height: number) => Lienzo
): EncodePng {
  const fabricar = crear ?? crearLienzo;
  return async (imagen: Bitmap) => {
    const lienzo = fabricar(imagen.width, imagen.height);
    lienzo.width = imagen.width;
    lienzo.height = imagen.height;
    const ctx = lienzo.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error("Este navegador no tiene contexto 2D.");
    const datos = ctx.createImageData(imagen.width, imagen.height);
    datos.data.set(imagen.data);
    ctx.putImageData(datos, 0, 0);
    const blob = await aBlob(lienzo);
    return new Uint8Array(await blob.arrayBuffer());
  };
}
