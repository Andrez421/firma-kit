// Modo "escribir": la mitad que puede ser pura.
//
// Medir y pintar texto exige una fuente rasterizada, y en el navegador eso es
// `CanvasRenderingContext2D` — DOM. Por eso el layout vive aquí y el dibujo
// entra por el puerto `TextRasterizer`: la decisión de cuántas líneas caben y a
// qué tamaño se toma sin DOM, con un medidor inyectado, y se puede probar en
// Node. ADR-001 sigue intacto.
//
// Las fuentes son las cuatro de GCly (ya usadas con personas reales), todas OFL
// y self-hosted: sin Google Fonts en runtime y sin `html-to-image`.

import type { Bitmap } from "../tipos.js";

/** Las cuatro cursivas disponibles, por orden de preferencia. */
export const FUENTES_ESCRIBIR = [
  "Caveat",
  "Pacifico",
  "Great Vibes",
  "Sacramento",
] as const;

export type FuenteEscribir = (typeof FUENTES_ESCRIBIR)[number];

export type EstiloTexto = { familia: string; tamano: number };

/** Puerto de medida: en el navegador mide canvas con la fuente ya cargada. */
export type MedidorTexto = {
  medir: (texto: string, estilo: EstiloTexto) => { ancho: number; alto: number };
};

/**
 * Puerto de rasterizado de texto. `core` decide el layout; el adaptador pinta
 * las líneas en un `Bitmap` opaco. Devuelve `null` si no pudo dibujar (fuente
 * no cargada), que el llamador traduce a un rechazo explicable, nunca a un PNG
 * a medias.
 */
export type TextRasterizer = {
  rasterizar: (
    lineas: string[],
    estilo: EstiloTexto,
    interlineado: number,
    caja: { width: number; height: number }
  ) => Bitmap | null;
};

export type LayoutEscribir = {
  lineas: string[];
  estilo: EstiloTexto;
  /** Distancia entre líneas, ya en píxeles. */
  interlineado: number;
};

export type OpcionesEscribir = {
  /** Familia cursiva. Por defecto Caveat, la más legible en tamaño pequeño. */
  familia?: FuenteEscribir;
  tamanoMaximo?: number;
  tamanoMinimo?: number;
  /** Líneas máximas del nombre. Una firma manuscrita no es un párrafo. */
  lineasMaximas?: number;
};

/** Proporción del tamaño de fuente que ocupa cada línea. */
const INTERLINEADO = 1.15;

/**
 * Reparte las palabras en líneas que quepan en `anchoMax`. Devuelve `null` si
 * una sola palabra no cabe: en ese caso hay que reducir el tamaño, no partir la
 * palabra ni recortarla.
 */
function envolver(
  palabras: string[],
  anchoMax: number,
  medidor: MedidorTexto,
  estilo: EstiloTexto
): string[] | null {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (medidor.medir(candidata, estilo).ancho <= anchoMax) {
      actual = candidata;
      continue;
    }
    if (!actual) return null;
    if (medidor.medir(palabra, estilo).ancho > anchoMax) return null;
    lineas.push(actual);
    actual = palabra;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/**
 * Layout del nombre: el tamaño más grande al que cabe en la caja, sin pasar de
 * `lineasMaximas`. Si el nombre es tan largo que no cabe ni al tamaño mínimo, se
 * devuelve el mínimo en vez de rechazarlo: el nombre de una persona no es un
 * dato que este módulo pueda pedir que se acorte.
 */
export function layoutEscribir(
  texto: string,
  caja: { width: number; height: number },
  medidor: MedidorTexto,
  opciones: OpcionesEscribir = {}
): LayoutEscribir | null {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!limpio) return null;

  const familia = opciones.familia ?? "Caveat";
  const tamanoMaximo = Math.max(1, opciones.tamanoMaximo ?? 72);
  const tamanoMinimo = Math.min(
    Math.max(1, opciones.tamanoMinimo ?? 12),
    tamanoMaximo
  );
  const lineasMaximas = Math.max(1, opciones.lineasMaximas ?? 2);
  const palabras = limpio.split(" ");

  for (let tamano = tamanoMaximo; tamano >= tamanoMinimo; tamano--) {
    const estilo = { familia, tamano };
    const lineas = envolver(palabras, caja.width, medidor, estilo);
    if (!lineas || lineas.length > lineasMaximas) continue;
    const interlineado = tamano * INTERLINEADO;
    if (lineas.length * interlineado > caja.height) continue;
    return { lineas, estilo, interlineado };
  }

  const estilo = { familia, tamano: tamanoMinimo };
  const interlineado = tamanoMinimo * INTERLINEADO;
  const repartidas = envolver(palabras, caja.width, medidor, estilo) ?? [
    limpio,
  ];
  // Sin espacio ni al mínimo: las palabras sobrantes van a la última línea, que
  // se dibuja desbordada antes que perder parte del nombre.
  const lineas =
    repartidas.length > lineasMaximas
      ? [
          ...repartidas.slice(0, lineasMaximas - 1),
          repartidas.slice(lineasMaximas - 1).join(" "),
        ]
      : repartidas;
  return { lineas, estilo, interlineado };
}
