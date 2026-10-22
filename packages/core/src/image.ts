// Operaciones de imagen sin dependencias: lo mínimo que un módulo de firma
// necesita para entregar el PNG que promete (ancho máximo, fondo opaco).

import type { Bitmap } from "./types.js";

/**
 * Reduce la image hasta `anchoMaximo` promediando bloques, conservando la
 * proporción. Nunca agranda (devolver la misma referencia evita copias inútiles)
 * y nunca devuelve transparencia: el PNG final es siempre opaco.
 */
export function scaleToWidth(image: Bitmap, maxWidth: number): Bitmap {
  const limit = Math.max(1, Math.floor(maxWidth));
  if (image.width <= limit) return image;
  const width = limit;
  const height = Math.max(
    1,
    Math.round((image.height * width) / image.width)
  );
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * image.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * image.width + sx) * 4;
          r += image.data[i]!;
          g += image.data[i + 1]!;
          b += image.data[i + 2]!;
          a += image.data[i + 3]!;
          n++;
        }
      }
      const o = (y * width + x) * 4;
      data[o] = r / n;
      data[o + 1] = g / n;
      data[o + 2] = b / n;
      data[o + 3] = a / n;
    }
  }
  return { data, width, height };
}

/**
 * Reduce la image hasta que su lado mayor quepa en `ladoMaximo`, conservando
 * la proporción. Es el limit de memoria del análisis: una foto de móvil de
 * 4000px no se procesa entera.
 */
export function scaleToMaxSide(image: Bitmap, ladoMaximo: number): Bitmap {
  const limit = Math.max(1, Math.floor(ladoMaximo));
  if (Math.max(image.width, image.height) <= limit) return image;
  if (image.width >= image.height) return scaleToWidth(image, limit);
  const width = Math.max(1, Math.round((image.width * limit) / image.height));
  return scaleToWidth(image, width);
}
