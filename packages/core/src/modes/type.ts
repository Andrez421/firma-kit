// Modo "escribir": la mitad que puede ser pura.
//
// Medir y pintar texto exige una fuente rasterizada, y en el navegador eso es
// `CanvasRenderingContext2D` — DOM. Por eso el layout vive aquí y el dibujo
// entra por el puerto `TextRasterizer`: la decisión de cuántas líneas caben y a
// qué tamaño se toma sin DOM, con un medidor inyectado, y se puede probar en
// Node. ADR-001 sigue intacto.
//
// Las fuentes son diez cursivas, todas OFL y self-hosted: sin Google Fonts en
// runtime y sin `html-to-image`. Las cuatro primeras vienen de GCly (ya usadas con
// personas reales); las seis siguientes amplían la elección.

import type { Bitmap } from "../types.js";

/** Las cursivas disponibles, por orden de preferencia. */
export const TYPE_FONTS = [
  "Caveat",
  "Pacifico",
  "Great Vibes",
  "Sacramento",
  "Dancing Script",
  "Alex Brush",
  "Allura",
  "Parisienne",
  "Kaushan Script",
  "Marck Script",
] as const;

export type TypeFont = (typeof TYPE_FONTS)[number];

export type TextStyle = { family: string; size: number };

/** Puerto de medida: en el navegador mide canvas con la fuente ya cargada. */
export type TextMeasurer = {
  measure: (text: string, style: TextStyle) => { width: number; height: number };
};

/**
 * Puerto de rasterizado de texto. `core` decide el layout; el adaptador pinta
 * las líneas en un `Bitmap` opaco. Devuelve `null` si no pudo dibujar (fuente
 * no cargada), que el llamador traduce a un rejection explicable, nunca a un PNG
 * a medias.
 */
export type TextRasterizer = {
  rasterize: (
    lines: string[],
    style: TextStyle,
    lineHeight: number,
    bounds: { width: number; height: number }
  ) => Bitmap | null;
};

export type TypeLayout = {
  lines: string[];
  style: TextStyle;
  /** Distancia entre líneas, ya en píxeles. */
  lineHeight: number;
};

export type TypeOptions = {
  /** Familia cursiva. Por defecto Caveat, la más legible en tamaño pequeño. */
  family?: TypeFont;
  maxSize?: number;
  minSize?: number;
  /** Líneas máximas del name. Una signature manuscrita no es un párrafo. */
  maxLines?: number;
};

/** Proporción del tamaño de fuente que ocupa cada línea. */
const LINE_HEIGHT = 1.15;

/**
 * Reparte las words en líneas que quepan en `maxWidth`. Devuelve `null` si
 * una sola palabra no cabe: en ese caso hay que reducir el tamaño, no partir la
 * palabra ni recortarla.
 */
function wrap(
  words: string[],
  maxWidth: number,
  measurer: TextMeasurer,
  style: TextStyle
): string[] | null {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measurer.measure(candidate, style).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (!current) return null;
    if (measurer.measure(word, style).width > maxWidth) return null;
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Layout del name: el tamaño más grande al que cabe en la bounds, sin pasar de
 * `lineasMaximas`. Si el name es tan largo que no cabe ni al tamaño mínimo, se
 * devuelve el mínimo en vez de rechazarlo: el name de una persona no es un
 * dato que este módulo pueda pedir que se acorte.
 */
export function layoutTypedName(
  text: string,
  bounds: { width: number; height: number },
  measurer: TextMeasurer,
  options: TypeOptions = {}
): TypeLayout | null {
  const cleanName = text.replace(/\s+/g, " ").trim();
  if (!cleanName) return null;

  const family = options.family ?? "Caveat";
  const maxSize = Math.max(1, options.maxSize ?? 72);
  const minSize = Math.min(
    Math.max(1, options.minSize ?? 12),
    maxSize
  );
  const maxLines = Math.max(1, options.maxLines ?? 2);
  const words = cleanName.split(" ");

  for (let size = maxSize; size >= minSize; size--) {
    const style = { family, size };
    const lines = wrap(words, bounds.width, measurer, style);
    if (!lines || lines.length > maxLines) continue;
    const lineHeight = size * LINE_HEIGHT;
    if (lines.length * lineHeight > bounds.height) continue;
    return { lines, style, lineHeight };
  }

  const style = { family, size: minSize };
  const lineHeight = minSize * LINE_HEIGHT;
  const wrapped = wrap(words, bounds.width, measurer, style) ?? [
    cleanName,
  ];
  // Sin espacio ni al mínimo: las palabras sobrantes van a la última línea, que
  // se dibuja desbordada antes que perder parte del nombre.
  const lines =
    wrapped.length > maxLines
      ? [
          ...wrapped.slice(0, maxLines - 1),
          wrapped.slice(maxLines - 1).join(" "),
        ]
      : wrapped;
  return { lines, style, lineHeight };
}
