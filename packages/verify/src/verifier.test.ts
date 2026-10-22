import { describe, expect, it, vi } from "vitest";

import type { Bitmap } from "@firma-kit/core";

import { createTwoTierVerifier, type Gate, type SecondOpinion } from "./verifier.js";
import { THRESHOLDS } from "./thresholds.js";

const imagen: Bitmap = {
  data: new Uint8ClampedArray(4),
  width: 1,
  height: 1,
};

const gate = (score: number): Gate => ({ score: async () => score });

describe("createTwoTierVerifier", () => {
  it("acepta en el nivel 1 en cuanto alcanza el umbral de aceptación", async () => {
    const verificador = createTwoTierVerifier({ gate: gate(THRESHOLDS.gateAccept) });
    await expect(verificador.verify(imagen)).resolves.toEqual({
      isSignature: true,
      confidence: THRESHOLDS.gateAccept,
      tier: 1,
    });
  });

  it("rechaza en el nivel 1 en cuanto baja al umbral de rechazo", async () => {
    const verificador = createTwoTierVerifier({ gate: gate(THRESHOLDS.gateReject) });
    const veredicto = await verificador.verify(imagen);
    expect(veredicto.isSignature).toBe(false);
    expect(veredicto.tier).toBe(1);
    // La confianza de un rechazo es la certeza de que NO es firma.
    expect(veredicto.confidence).toBeCloseTo(1 - THRESHOLDS.gateReject);
  });

  it("sin segunda opinión, un resultado ambiguo se acepta y no se rechaza", async () => {
    // La métrica que no se negocia son los falsos rechazos: un "quizá" deja
    // firmar a la persona y queda registrado con confianza baja.
    const verificador = createTwoTierVerifier({ gate: gate(0.75) });
    await expect(verificador.verify(imagen)).resolves.toEqual({
      isSignature: true,
      confidence: 0.75,
      tier: 1,
    });
  });

  it("con segunda opinión, un resultado ambiguo se decide en el nivel 2", async () => {
    const decide = vi.fn(async () => ({ isSignature: false, confidence: 0.9 }));
    const segunda: SecondOpinion = { decide };
    const verificador = createTwoTierVerifier({ gate: gate(0.75), secondOpinion: segunda });
    await expect(verificador.verify(imagen)).resolves.toEqual({
      isSignature: false,
      confidence: 0.9,
      tier: 2,
    });
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("no invoca la segunda opinión cuando el gate ya decidió", async () => {
    const decide = vi.fn(async () => ({ isSignature: true, confidence: 1 }));
    const verificador = createTwoTierVerifier({
      gate: gate(0.999),
      secondOpinion: { decide },
    });
    await verificador.verify(imagen);
    expect(decide).not.toHaveBeenCalled();
  });

  it("rechaza construir con umbrales invertidos", () => {
    expect(() =>
      createTwoTierVerifier({
        gate: gate(0.5),
        thresholds: { gateAccept: 0.3, gateReject: 0.8 },
      })
    ).toThrow(/gateReject/);
  });

  it("acepta umbrales propios sin tocar los de la casa", async () => {
    const verificador = createTwoTierVerifier({
      gate: gate(0.6),
      thresholds: { gateAccept: 0.55, gateReject: 0.2 },
    });
    const veredicto = await verificador.verify(imagen);
    expect(veredicto.isSignature).toBe(true);
    expect(THRESHOLDS.gateAccept).toBe(0.99);
  });
});
