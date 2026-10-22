import { describe, expect, it, vi } from "vitest";

import type { Bitmap, Verifier } from "@firma-kit/core";

import { BUDGETS, type CorpusEntry } from "./manifest.js";
import { formatReport, runEval } from "./runner.js";

const imagen: Bitmap = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

/** Verificador que devuelve una secuencia de veredictos, en orden. */
function verificadorEnSerie(esFirma: boolean[]): Verifier {
  let i = 0;
  return {
    verify: async () => ({
      isSignature: esFirma[i++] ?? false,
      confidence: 0.9,
      tier: 1,
    }),
  };
}

const caso = (nombre: string, label: CorpusEntry["label"]): CorpusEntry => ({
  path: nombre,
  label,
  source: "synthetic",
  licence: "CC0-1.0",
});

describe("runEval", () => {
  it("un lote perfecto pasa y cuenta la matriz", async () => {
    const report = await runEval({
      cases: [caso("a.png", "signature"), caso("b.png", "not_signature")],
      verifier: verificadorEnSerie([true, false]),
      loadImage: async () => imagen,
      budgets: BUDGETS,
      verifierName: "test",
    });
    expect(report).toMatchObject({
      total: 2,
      truePositives: 1,
      trueNegatives: 1,
      falseNegatives: 0,
      falsePositives: 0,
      falseRejectionRate: 0,
      falseAcceptRate: 0,
      negativeAccuracy: 1,
      passed: true,
      reasons: [],
    });
  });

  it("un falso rechazo por encima del presupuesto hace fallar el lote", async () => {
    // 2 de 10 firmas rechazadas = 20 % > 2 %.
    const cases = [
      ...Array.from({ length: 10 }, (_, i) => caso(`f${i}.png`, "signature")),
      caso("n0.png", "not_signature"),
    ];
    const veredictos = [...Array.from({ length: 10 }, (_, i) => i >= 2), false];
    const report = await runEval({
      cases,
      verifier: verificadorEnSerie(veredictos),
      loadImage: async () => imagen,
      budgets: BUDGETS,
      verifierName: "test",
    });
    expect(report.falseRejectionRate).toBeCloseTo(0.2);
    expect(report.passed).toBe(false);
    expect(report.reasons.join(" ")).toMatch(/falsos rechazos/);
    expect(report.failures).toHaveLength(2);
  });

  it("demasiados falsos aceptados también hace fallar el lote", async () => {
    const cases = [
      caso("f0.png", "signature"),
      ...Array.from({ length: 10 }, (_, i) => caso(`n${i}.png`, "not_signature")),
    ];
    // Acepta todas las firmas y 5 de 10 negativos: falsos aceptados = 50 %.
    const veredictos = [true, ...Array.from({ length: 10 }, (_, i) => i < 5)];
    const report = await runEval({
      cases,
      verifier: verificadorEnSerie(veredictos),
      loadImage: async () => imagen,
      budgets: BUDGETS,
      verifierName: "test",
    });
    // 5 de 10 negativos aceptados por error: el FAR real es el 50 %.
    expect(report.falseAcceptRate).toBeCloseTo(0.5);
    expect(report.negativeAccuracy).toBeCloseTo(0.5);
    expect(report.passed).toBe(false);
    expect(report.reasons.join(" ")).toMatch(/rechaza .* de los negativos/);
  });

  it("un lote con material sin licencia no es evidencia, aunque el verificador acierte", async () => {
    const report = await runEval({
      cases: [
        caso("a.png", "signature"),
        { ...caso("b.jpg", "not_signature"), source: "web-unverified", licence: "unknown" },
      ],
      verifier: verificadorEnSerie([true, false]),
      loadImage: async () => imagen,
      budgets: BUDGETS,
      verifierName: "test",
    });
    expect(report.evidence).toBe(false);
    expect(report.passed).toBe(false);
    expect(report.reasons.join(" ")).toMatch(/sin licencia verificada/);
  });

  it("cuenta las imágenes marcadas como sensibles", async () => {
    const report = await runEval({
      cases: [
        { ...caso("a.png", "signature"), sensitive: true },
        caso("b.png", "not_signature"),
      ],
      verifier: verificadorEnSerie([true, false]),
      loadImage: async () => imagen,
      budgets: BUDGETS,
      verifierName: "test",
    });
    expect(report.sensitive).toBe(1);
  });

  it("se niega a medir con una sola clase: no hay matriz que leer", async () => {
    await expect(
      runEval({
        cases: [caso("a.png", "signature")],
        verifier: verificadorEnSerie([true]),
        loadImage: async () => imagen,
        budgets: BUDGETS,
      verifierName: "test",
      })
    ).rejects.toThrow(/negativos/);
  });

  it("se niega a medir sin casos", async () => {
    await expect(
      runEval({
        cases: [],
        verifier: verificadorEnSerie([]),
        loadImage: async () => imagen,
        budgets: BUDGETS,
      verifierName: "test",
      })
    ).rejects.toThrow(/vacío|no hay casos/);
  });

  it("mide latencias con el reloj inyectado", async () => {
    let t = 0;
    const report = await runEval({
      cases: [caso("a.png", "signature"), caso("b.png", "not_signature")],
      verifier: {
        verify: async () => {
          t += 10;
          return { isSignature: true, confidence: 0.9, tier: 1 };
        },
      },
      loadImage: async () => imagen,
      budgets: BUDGETS,
      verifierName: "test",
      now: () => t,
    });
    expect(report.latencyMs.p50).toBe(10);
    expect(report.latencyMs.max).toBe(10);
  });

  it("el informe legible dice si pasa y por qué no", () => {
    const texto = formatReport({
      verifier: "baseline-ink",
      evidence: true,
      sensitive: 0,
      total: 10,
      truePositives: 8,
      falseNegatives: 2,
      trueNegatives: 0,
      falsePositives: 0,
      falseRejectionRate: 0.2,
      falseAcceptRate: 1,
      negativeAccuracy: 0,
      falseRejectionInterval: { lower: 0.06, upper: 0.45 },
      falseAcceptInterval: { lower: 0.7, upper: 1 },
      negativeAccuracyInterval: { lower: 0, upper: 0.3 },
      positivesNeeded: 150,
      latencyMs: { p50: 12, p95: 40, max: 55 },
      failures: [],
      passed: false,
      reasons: ["falsos rechazos 20.0 % > 2 %"],
    });
    expect(texto).toMatch(/RESULTADO: falla/);
    expect(texto).toMatch(/p95 40 ms/);
  });
});
