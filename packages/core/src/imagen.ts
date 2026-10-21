// Operaciones de imagen sin dependencias: lo mínimo que un módulo de firma
// necesita para entregar el PNG que promete (ancho máximo, fondo opaco).

import type { Bitmap } from "./tipos.js";

/**
 * Reduce la imagen hasta `anchoMaximo` promediando bloques, conservando la
 * proporción. Nunca agranda (devolver la misma referencia evita copias inútiles)
 * y nunca devuelve transparencia: el PNG final es siempre opaco.
 */
export function scaleToWidth(imagen: Bitmap, anchoMaximo: number): Bitmap {
  const tope = Math.max(1, Math.floor(anchoMaximo));
  if (imagen.width <= tope) return imagen;
  const width = tope;
  const height = Math.max(
    1,
    Math.round((imagen.height * width) / imagen.width)
  );
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * imagen.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * imagen.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * imagen.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * imagen.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * imagen.width + sx) * 4;
          r += imagen.data[i]!;
          g += imagen.data[i + 1]!;
          b += imagen.data[i + 2]!;
          a += imagen.data[i + 3]!;
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
 * Reduce la imagen hasta que su lado mayor quepa en `ladoMaximo`, conservando
 * la proporción. Es el tope de memoria del análisis: una foto de móvil de
 * 4000px no se procesa entera.
 */
export function scaleToMaxSide(imagen: Bitmap, ladoMaximo: number): Bitmap {
  const tope = Math.max(1, Math.floor(ladoMaximo));
  if (Math.max(imagen.width, imagen.height) <= tope) return imagen;
  if (imagen.width >= imagen.height) return scaleToWidth(imagen, tope);
  const ancho = Math.max(1, Math.round((imagen.width * tope) / imagen.height));
  return scaleToWidth(imagen, ancho);
}
