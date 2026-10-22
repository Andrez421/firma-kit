import { describe, expect, it } from "vitest";

import { startStroke } from "./strokes.js";

const punto = (x: number, y: number, t = 0) => ({ x, y, t });

describe("inicio de un trazo", () => {
  it("empieza donde se apoya el puntero cuando no se enlaza", () => {
    const previos = [[punto(1, 1), punto(2, 2)]];
    const resultado = startStroke(previos, punto(9, 9), false);
    expect(resultado).toHaveLength(2);
    expect(resultado[1]).toEqual([punto(9, 9)]);
  });

  it("enlaza con el último punto del trazo anterior cuando se pide", () => {
    const previos = [[punto(1, 1), punto(2, 2)]];
    const resultado = startStroke(previos, punto(9, 9), true);
    expect(resultado[1]).toEqual([punto(2, 2), punto(9, 9)]);
  });

  it("no inventa un enlace si no hay trazo anterior", () => {
    expect(startStroke([], punto(5, 5), true)).toEqual([[punto(5, 5)]]);
  });

  it("no muta la lista que recibe", () => {
    const previos = [[punto(1, 1), punto(2, 2)]];
    startStroke(previos, punto(3, 3), true);
    expect(previos).toHaveLength(1);
    expect(previos[0]).toHaveLength(2);
  });
});
