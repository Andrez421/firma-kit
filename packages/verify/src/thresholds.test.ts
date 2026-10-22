import { describe, expect, it } from "vitest";

import { THRESHOLDS, THRESHOLDS_VERSION } from "./thresholds.js";

describe("umbrales", () => {
  it("fija la versión: cambiarla es un acto deliberado", () => {
    // ADR-011: un umbral sin evidencia archivada es indistinguible de un ajuste
    // a ojo. Si este test falla, hay que traer el reporte de evaluación.
    expect(THRESHOLDS_VERSION).toBe("1");
  });

  it("fija los valores provisionales", () => {
    expect(THRESHOLDS).toEqual({ gateAccept: 0.72, gateReject: 0.35 });
  });

  it("mantiene una banda de ambigüedad real entre los dos umbrales", () => {
    expect(THRESHOLDS.gateReject).toBeLessThan(THRESHOLDS.gateAccept);
    expect(THRESHOLDS.gateAccept - THRESHOLDS.gateReject).toBeGreaterThan(0.2);
  });

  it("se queda dentro de 0..1", () => {
    for (const valor of Object.values(THRESHOLDS)) {
      expect(valor).toBeGreaterThan(0);
      expect(valor).toBeLessThan(1);
    }
  });
});
