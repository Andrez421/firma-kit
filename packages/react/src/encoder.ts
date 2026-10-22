// Codificador PNG del navegador: la implementación del puerto `EncodePng` que
// `core` no puede traer sin dejar de ser puro. Se mantiene aparte del componente
// para poder probarlo y sustituirlo.

import type { Bitmap, PngEncoder, Signature } from "@firma-kit/core";

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

function toBlob(canvas: Lienzo): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolver, rechazar) => {
    canvas.toBlob((blob) => {
      if (blob) resolver(blob);
      else rechazar(new Error("El navegador no pudo codificar el PNG."));
    }, "image/png");
  });
}

/**
 * Devuelve un `EncodePng` que dibuja el bitmap y lo codifica.
 *
 * Un navegador sin contexto 2D (un jsdom, un canvas bloqueado) no produce un
 * PNG falso: la promesa se rechaza, y el llamador lo convierte en un rejection
 * explicable en vez de guardar una image que no existe.
 */
export function createCanvasPngEncoder(
  create?: (width: number, height: number) => Lienzo
): PngEncoder {
  const factory = create ?? createCanvas;
  return async (image: Bitmap) => {
    const canvas = factory(image.width, image.height);
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error("Este navegador no tiene contexto 2D.");
    const data = ctx.createImageData(image.width, image.height);
    data.data.set(image.data);
    ctx.putImageData(data, 0, 0);
    const blob = await toBlob(canvas);
    return new Uint8Array(await blob.arrayBuffer());
  };
}

/**
 * Convierte los bytes de una signature en un `Blob` listo para `createObjectURL`,
 * una descarga o un `FormData`.
 *
 * Vive aquí y no en `core` porque un `Blob` es del navegador. La copia no es un
 * capricho: `Uint8Array<ArrayBufferLike>` no es un `BlobPart` en TypeScript 5.7+,
 * y construir el `Uint8Array` de nuevo le da su propio `ArrayBuffer`.
 */
export function toPngBlob(signature: Pick<Signature, "png">): Blob {
  return new Blob([new Uint8Array(signature.png)], { type: "image/png" });
}
