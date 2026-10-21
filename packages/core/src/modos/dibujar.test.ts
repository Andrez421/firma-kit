import { describe, expect, it } from "vitest";

import type { Bitmap } from "../tipos.js";
import {
  rasterizeStroke,
  smoothStroke,
  strokeWidths,
  type PuntoTrazo,
} from "./dibujar.js";

const ANCHO = 120;
const ALTO = 48;
const LIENZO = { width: ANCHO, height: ALTO };

/** Píxeles oscuros: lo que en el PNG final se ve como tinta. */
function tinta(imagen: Bitmap): number {
  let cuenta = 0;
  for (let i = 0; i < imagen.data.length; i += 4) {
    if (imagen.data[i]! < 128) cuenta++;
  }
  return cuenta;
}

/** Trazo horizontal, `paso` px entre muestras y `dt` ms entre ellas. */
function horizontal(paso: number, dt: number, desde = 10, y = 24): PuntoTrazo[] {
  const puntos: PuntoTrazo[] = [];
  for (let x = desde; x <= ANCHO - 10; x += paso) {
    puntos.push({ x, y, t: puntos.length * dt });
  }
  return puntos;
}

describe("rasterizeStroke", () => {
  it("un trazo sin recorrido deja el lienzo limpio, no lanza", () => {
    for (const puntos of [[], [{ x: 10, y: 10, t: 0 }]]) {
      const imagen = rasterizeStroke(puntos, LIENZO);
      expect(imagen.width).toBe(ANCHO);
      expect(imagen.height).toBe(ALTO);
      expect(tinta(imagen)).toBe(0);
    }
  });

  it("pinta el trazo y deja el papel blanco y opaco", () => {
    const imagen = rasterizeStroke(horizontal(2, 16), LIENZO);
    expect(tinta(imagen)).toBeGreaterThan(0);
    // Esquinas: papel puro.
    expect(imagen.data[0]).toBe(255);
    const ultima = (ALTO - 1) * ANCHO * 4 + (ANCHO - 1) * 4;
    expect(imagen.data[ultima]).toBe(255);
    // Toda la imagen es opaca: nunca se guarda un PNG con transparencia.
    for (let i = 3; i < imagen.data.length; i += 4) {
      expect(imagen.data[i]).toBe(255);
    }
  });

  it("dibuja más fino cuando el puntero va rápido (presión simulada)", () => {
    const lento = tinta(rasterizeStroke(horizontal(1, 40), LIENZO));
    const rapido = tinta(rasterizeStroke(horizontal(1, 1), LIENZO));
    expect(rapido).toBeGreaterThan(0);
    expect(rapido).toBeLessThan(lento);
  });

  it("es determinista: el mismo trazo da exactamente los mismos bytes", () => {
    const a = rasterizeStroke(horizontal(3, 8), LIENZO);
    const b = rasterizeStroke(horizontal(3, 8), LIENZO);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it("respeta los límites del lienzo aunque el trazo se salga", () => {
    const fuera: PuntoTrazo[] = [
      { x: -50, y: 10, t: 0 },
      { x: ANCHO + 50, y: 40, t: 10 },
    ];
    const imagen = rasterizeStroke(fuera, LIENZO);
    expect(imagen.data.length).toBe(ANCHO * ALTO * 4);
    expect(tinta(imagen)).toBeGreaterThan(0);
  });
});

describe("strokeWidths", () => {
  it("acota el grosor entre el mínimo y el máximo configurados", () => {
    const anchos = strokeWidths(horizontal(1, 1), {
      grosorMinimo: 1,
      grosorMaximo: 4,
    });
    expect(anchos.length).toBe(horizontal(1, 1).length);
    for (const a of anchos) {
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(4);
    }
  });
});

describe("smoothStroke", () => {
  const zigzag: PuntoTrazo[] = Array.from({ length: 9 }, (_, i) => ({
    x: 10 + i * 8,
    y: i % 2 === 0 ? 16 : 32,
    t: i * 10,
  }));

  it("reduce el zigzag sin mover los extremos", () => {
    const suave = smoothStroke(zigzag);
    expect(suave.length).toBe(zigzag.length);
    expect(suave[0]).toEqual(zigzag[0]);
    expect(suave.at(-1)).toEqual(zigzag.at(-1));

    // Los extremos se conservan a propósito, así que la desviación se mide
    // solo en el interior: ahí es donde el filtro actúa.
    const desvio = (puntos: PuntoTrazo[]) =>
      Math.max(...puntos.slice(1, -1).map((p) => Math.abs(p.y - 24)));
    expect(desvio(suave)).toBeLessThan(desvio(zigzag) * 0.6);
  });

  it("con menos de tres puntos devuelve el mismo trazo", () => {
    const dos = zigzag.slice(0, 2);
    expect(smoothStroke(dos)).toEqual(dos);
  });
});
