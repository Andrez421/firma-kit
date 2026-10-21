// Modo "dibujar": la parte que puede ser pura. El puntero, el canvas y el
// evento táctil son del adaptador; aquí se convierte una lista de muestras en
// un PNG de tinta sobre blanco, sin DOM y sin estado global.
//
// Presión simulada: un puntero táctil no informa presión de forma fiable, así
// que se deriva de la velocidad — rápido = trazo fino, lento = trazo grueso.
// Es el mismo criterio en ratón, dedo y lápiz óptico, y por eso es testeable.

import type { Bitmap } from "../tipos.js";

/** Una muestra del puntero. `t` en milisegundos. */
export type PuntoTrazo = { x: number; y: number; t: number };

export type OpcionesTrazo = {
  /** Grosor mínimo en píxeles (trazo rápido). */
  grosorMinimo?: number;
  /** Grosor máximo en píxeles (trazo lento). */
  grosorMaximo?: number;
  /** 0 = sin suavizar, 1 = suavizado completo. */
  suavizado?: number;
  /** Velocidad (px/ms) a la que la presión simulada llega a su mínimo. */
  velocidadMaxima?: number;
  /** Nivel de gris de la tinta. 0 = negro puro. */
  tinta?: number;
};

const GROSOR_MINIMO = 1.2;
const GROSOR_MAXIMO = 3.4;
const VELOCIDAD_MAXIMA = 2.5;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Suaviza la polilínea con un filtro binomial de 5 muestras, mezclado según
 * `suavizado`. Los extremos se conservan: si se movieran, el trazo empezaría y
 * terminaría en otro sitio del que dibujó la persona.
 */
export function smoothStroke(
  puntos: PuntoTrazo[],
  opciones: OpcionesTrazo = {}
): PuntoTrazo[] {
  const factor = clamp01(opciones.suavizado ?? 1);
  if (puntos.length < 3 || factor === 0) return puntos;
  const pesos = [1, 2, 3, 2, 1];
  const salida = puntos.map((p) => ({ ...p }));
  for (let i = 1; i < puntos.length - 1; i++) {
    let sumaX = 0;
    let sumaY = 0;
    let sumaPesos = 0;
    for (let k = -2; k <= 2; k++) {
      const j = Math.min(puntos.length - 1, Math.max(0, i + k));
      const punto = puntos[j]!;
      const peso = pesos[k + 2]!;
      sumaX += punto.x * peso;
      sumaY += punto.y * peso;
      sumaPesos += peso;
    }
    const actual = puntos[i]!;
    const destino = salida[i]!;
    destino.x = actual.x + (sumaX / sumaPesos - actual.x) * factor;
    destino.y = actual.y + (sumaY / sumaPesos - actual.y) * factor;
  }
  return salida;
}

/**
 * Grosor de cada punto a partir de la velocidad local. Devuelve un ancho por
 * muestra para poder interpolar el trazo entre dos puntos.
 */
export function strokeWidths(
  puntos: PuntoTrazo[],
  opciones: OpcionesTrazo = {}
): number[] {
  const minimo = opciones.grosorMinimo ?? GROSOR_MINIMO;
  const maximo = opciones.grosorMaximo ?? GROSOR_MAXIMO;
  const velocidadMaxima = opciones.velocidadMaxima ?? VELOCIDAD_MAXIMA;
  const anchos = new Array<number>(puntos.length);
  for (let i = 0; i < puntos.length; i++) {
    const previo = puntos[Math.max(0, i - 1)]!;
    const siguiente = puntos[Math.min(puntos.length - 1, i + 1)]!;
    const dt = siguiente.t - previo.t;
    const distancia = Math.hypot(
      siguiente.x - previo.x,
      siguiente.y - previo.y
    );
    const velocidad = dt > 0 ? distancia / dt : 0;
    const presion = clamp01(1 - velocidad / velocidadMaxima);
    anchos[i] = minimo + (maximo - minimo) * presion;
  }
  return anchos;
}

/**
 * Pinta el trazo en un lienzo opaco blanco. La cobertura es la distancia a la
 * cápsula del segmento, así que el borde queda suave sin depender de canvas.
 */
export function rasterizeStroke(
  puntos: PuntoTrazo[],
  size: { width: number; height: number },
  opciones: OpcionesTrazo = {}
): Bitmap {
  const { width, height } = size;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (puntos.length < 2 || width <= 0 || height <= 0) {
    return { data, width, height };
  }

  const suave = smoothStroke(puntos, opciones);
  const anchos = strokeWidths(suave, opciones);
  const cobertura = new Float32Array(width * height);
  for (let i = 1; i < suave.length; i++) {
    const a = suave[i - 1]!;
    const b = suave[i]!;
    segmento(
      cobertura,
      width,
      height,
      a.x,
      a.y,
      b.x,
      b.y,
      anchos[i - 1]! / 2,
      anchos[i]! / 2
    );
  }

  const tinta = opciones.tinta ?? 0;
  for (let i = 0; i < cobertura.length; i++) {
    const c = cobertura[i]!;
    if (c <= 0) continue;
    const v = Math.round(255 + (tinta - 255) * Math.min(1, c));
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
  }
  return { data, width, height };
}

function segmento(
  cobertura: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r0: number,
  r1: number
): void {
  const radioMaximo = Math.max(r0, r1);
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - radioMaximo - 1));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + radioMaximo + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - radioMaximo - 1));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + radioMaximo + 1));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const largo2 = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let t = largo2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / largo2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = x0 + t * dx;
      const cy = y0 + t * dy;
      const distancia = Math.hypot(px - cx, py - cy);
      const radio = r0 + (r1 - r0) * t;
      const c = radio + 0.5 - distancia;
      if (c <= 0) continue;
      const idx = y * width + x;
      const valor = c > 1 ? 1 : c;
      if (valor > cobertura[idx]!) cobertura[idx] = valor;
    }
  }
}
