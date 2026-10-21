// Modo "dibujar": la parte que puede ser pura. El puntero, el canvas y el
// evento táctil son del adaptador; aquí se convierte una lista de muestras en
// un PNG de tinta sobre blanco, sin DOM y sin estado global.
//
// Presión simulada: un puntero táctil no informa presión de forma fiable, así
// que se deriva de la velocidad — rápido = trazo fino, lento = trazo grueso.
// Es el mismo criterio en ratón, dedo y lápiz óptico, y por eso es testeable.

import type { Bitmap } from "../types.js";

/** Una muestra del puntero. `t` en milisegundos. */
export type StrokePoint = { x: number; y: number; t: number };

export type StrokeOptions = {
  /** Grosor mínimo en píxeles (stroke rápido). */
  grosorMinimo?: number;
  /** Grosor máximo en píxeles (stroke lento). */
  grosorMaximo?: number;
  /** 0 = sin suavizar, 1 = suavizado completo. */
  suavizado?: number;
  /** Velocidad (px/ms) a la que la presión simulada llega a su mínimo. */
  velocidadMaxima?: number;
  /** Nivel de gris de la tinta. 0 = negro puro. */
  tinta?: number;
};

const MIN_STROKE_WIDTH = 1.2;
const MAX_STROKE_WIDTH = 3.4;
const MAX_SPEED = 2.5;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Suaviza la polilínea con un filtro binomial de 5 muestras, mezclado según
 * `suavizado`. Los extremos se conservan: si se movieran, el stroke empezaría y
 * terminaría en otro sitio del que dibujó la persona.
 */
export function smoothStroke(
  points: StrokePoint[],
  options: StrokeOptions = {}
): StrokePoint[] {
  const factor = clamp01(options.suavizado ?? 1);
  if (points.length < 3 || factor === 0) return points;
  const pesos = [1, 2, 3, 2, 1];
  const found = points.map((p) => ({ ...p }));
  for (let i = 1; i < points.length - 1; i++) {
    let sumaX = 0;
    let sumaY = 0;
    let sumaPesos = 0;
    for (let k = -2; k <= 2; k++) {
      const j = Math.min(points.length - 1, Math.max(0, i + k));
      const point = points[j]!;
      const peso = pesos[k + 2]!;
      sumaX += point.x * peso;
      sumaY += point.y * peso;
      sumaPesos += peso;
    }
    const current = points[i]!;
    const destino = found[i]!;
    destino.x = current.x + (sumaX / sumaPesos - current.x) * factor;
    destino.y = current.y + (sumaY / sumaPesos - current.y) * factor;
  }
  return found;
}

/**
 * Grosor de cada point a partir de la velocidad local. Devuelve un width por
 * muestra para poder interpolar el stroke entre dos points.
 */
export function strokeWidths(
  points: StrokePoint[],
  options: StrokeOptions = {}
): number[] {
  const min = options.grosorMinimo ?? MIN_STROKE_WIDTH;
  const max = options.grosorMaximo ?? MAX_STROKE_WIDTH;
  const velocidadMaxima = options.velocidadMaxima ?? MAX_SPEED;
  const widths = new Array<number>(points.length);
  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dt = next.t - previous.t;
    const distancia = Math.hypot(
      next.x - previous.x,
      next.y - previous.y
    );
    const velocidad = dt > 0 ? distancia / dt : 0;
    const presion = clamp01(1 - velocidad / velocidadMaxima);
    widths[i] = min + (max - min) * presion;
  }
  return widths;
}

/**
 * Pinta el stroke en un canvas opaco blanco. La coverage es la distancia a la
 * cápsula del segment, así que el borde remaining smoothed sin depender de canvas.
 */
export function rasterizeStroke(
  points: StrokePoint[],
  size: { width: number; height: number },
  options: StrokeOptions = {}
): Bitmap {
  const { width, height } = size;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (points.length < 2 || width <= 0 || height <= 0) {
    return { data, width, height };
  }

  const smoothed = smoothStroke(points, options);
  const widths = strokeWidths(smoothed, options);
  const coverage = new Float32Array(width * height);
  for (let i = 1; i < smoothed.length; i++) {
    const a = smoothed[i - 1]!;
    const b = smoothed[i]!;
    segment(
      coverage,
      width,
      height,
      a.x,
      a.y,
      b.x,
      b.y,
      widths[i - 1]! / 2,
      widths[i]! / 2
    );
  }

  const tinta = options.tinta ?? 0;
  for (let i = 0; i < coverage.length; i++) {
    const c = coverage[i]!;
    if (c <= 0) continue;
    const v = Math.round(255 + (tinta - 255) * Math.min(1, c));
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
  }
  return { data, width, height };
}

function segment(
  coverage: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r0: number,
  r1: number
): void {
  const maxRadius = Math.max(r0, r1);
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - maxRadius - 1));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + maxRadius + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - maxRadius - 1));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + maxRadius + 1));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSq = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let t = lengthSq === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / lengthSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = x0 + t * dx;
      const cy = y0 + t * dy;
      const distancia = Math.hypot(px - cx, py - cy);
      const radio = r0 + (r1 - r0) * t;
      const c = radio + 0.5 - distancia;
      if (c <= 0) continue;
      const idx = y * width + x;
      const value = c > 1 ? 1 : c;
      if (value > coverage[idx]!) coverage[idx] = value;
    }
  }
}
