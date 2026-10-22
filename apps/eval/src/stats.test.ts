import { describe, expect, it } from "vitest";

import { muestrasParaCeroErrores, wilson } from "./stats.js";

describe("wilson", () => {
  it("con pocos casos el intervalo es ancho", () => {
    // 7 de 101 rechazados: el punto es 6,9 %, pero el intervalo no baja de ~3 %.
    const i = wilson(7, 101);
    expect(i.lower).toBeGreaterThan(0.02);
    expect(i.upper).toBeGreaterThan(0.12);
  });

  it("se estrecha al crecer la muestra, con la misma proporción", () => {
    const chico = wilson(7, 101);
    const grande = wilson(70, 1010);
    const ancho = (x: { lower: number; upper: number }) => x.upper - x.lower;
    expect(ancho(grande)).toBeLessThan(ancho(chico));
  });

  it("cero errores no da cero: el límite superior es distinto de 0", () => {
    const i = wilson(0, 42);
    expect(i.lower).toBe(0);
    expect(i.upper).toBeGreaterThan(0.05);
  });

  it("se queda dentro de [0, 1] y aguanta muestras vacías", () => {
    const i = wilson(0, 0);
    expect(i).toEqual({ lower: 0, upper: 1 });
    const perfecto = wilson(10, 10);
    expect(perfecto.upper).toBeLessThanOrEqual(1);
  });
});

describe("muestrasParaCeroErrores", () => {
  it("para afirmar ≤2 % de falsos rechazos hacen falta ~150 positivos", () => {
    // Regla de tres: cero errores en N acota el límite superior en 3/N.
    expect(muestrasParaCeroErrores(0.02)).toBe(150);
  });

  it("con presupuestos imposibles no promete nada", () => {
    expect(muestrasParaCeroErrores(0)).toBe(Infinity);
    expect(muestrasParaCeroErrores(1)).toBe(Infinity);
  });
});
