import { describe, expect, it } from "vitest";

import { planDePintado, type EstadoDelLienzo } from "./paintPlan.js";

const estado = (parcial: Partial<EstadoDelLienzo> = {}): EstadoDelLienzo => ({
  trazos: 1,
  puntos: 10,
  finalizado: 0,
  estilo: "0.9|3.4|0",
  ...parcial,
});

describe("plan de pintado del lienzo", () => {
  it("pinta solo el segmento cuando el trazo en curso suma un punto", () => {
    expect(planDePintado(estado(), estado({ puntos: 11 }))).toBe("segmento");
  });

  it("no pinta nada si nada cambió", () => {
    expect(planDePintado(estado(), estado())).toBe("nada");
  });

  it("hace la pasada exacta al soltar el puntero", () => {
    expect(planDePintado(estado(), estado({ puntos: 11, finalizado: 1 }))).toBe("completo");
  });

  it("hace la pasada exacta cuando cambia la estructura", () => {
    // Trazo nuevo, deshacer (menos puntos), borrar (menos trazos) y limpiar.
    expect(planDePintado(estado(), estado({ trazos: 2 }))).toBe("completo");
    expect(planDePintado(estado(), estado({ puntos: 4 }))).toBe("completo");
    expect(planDePintado(estado(), estado({ trazos: 0, puntos: 0 }))).toBe("completo");
    expect(planDePintado(estado(), estado({ puntos: 13 }))).toBe("completo");
  });

  it("hace la pasada exacta si cambian el grosor o la tinta", () => {
    expect(planDePintado(estado(), estado({ estilo: "1|4|0" }))).toBe("completo");
  });
});
