import { describe, expect, it } from "vitest";

import { BUDGETS, ManifestError, parseManifest } from "./manifest.js";

const valido = {
  path: "firmas/001.png",
  label: "signature",
  source: "synthetic",
  licence: "CC0-1.0",
};

describe("parseManifest", () => {
  it("acepta un manifiesto correcto", () => {
    expect(parseManifest([valido])).toEqual([valido]);
  });

  it("rechaza un manifiesto que no es arreglo o está vacío", () => {
    expect(() => parseManifest({})).toThrow(ManifestError);
    expect(() => parseManifest([])).toThrow(/vacío/);
  });

  it("rechaza etiquetas que no son de las dos clases", () => {
    expect(() => parseManifest([{ ...valido, label: "factura" }])).toThrow(/label/);
  });

  it("rechaza rutas absolutas y escapes del corpus", () => {
    expect(() => parseManifest([{ ...valido, path: "/etc/passwd" }])).toThrow(/relativo/);
    expect(() => parseManifest([{ ...valido, path: "../fuera.png" }])).toThrow(/relativo/);
  });

  it("rechaza rutas repetidas: contar dos veces la misma firma infla la métrica", () => {
    expect(() => parseManifest([valido, valido])).toThrow(/repetido/);
  });

  it("exige procedencia y licencia, y no acepta 'unknown' en fuentes reales", () => {
    expect(() => parseManifest([{ ...valido, source: "" }])).toThrow(/source/);
    expect(() => parseManifest([{ ...valido, licence: "" }])).toThrow(/licence/);
    expect(() =>
      parseManifest([{ ...valido, source: "https://dataset.example", licence: "unknown" }])
    ).toThrow(/licencia verificada/);
  });

  it("admite material sin licencia sólo bajo web-unverified y con licence unknown", () => {
    const entrada = {
      path: "web/a.jpg",
      label: "not_signature",
      source: "web-unverified",
      licence: "unknown",
    };
    expect(parseManifest([entrada])[0]!.source).toBe("web-unverified");
    // Si alguien dice tener licencia, entonces no es web-unverified: es una
    // fuente real y debe declarar cuál.
    expect(() =>
      parseManifest([{ ...entrada, licence: "CC-BY-4.0" }])
    ).toThrow(/exige licence/);
  });

  it("valida la marca de sensible y la conserva", () => {
    expect(
      parseManifest([{ ...valido, sensitive: true }])[0]!.sensitive
    ).toBe(true);
    expect(() =>
      parseManifest([{ ...valido, sensitive: "sí" }])
    ).toThrow(/sensitive/);
  });

  it("acepta licencia desconocida si el archivo es sintético", () => {
    expect(() => parseManifest([{ ...valido, licence: "unknown" }])).not.toThrow();
  });
});

describe("presupuestos", () => {
  it("fija la métrica que no se negocia: falsos rechazos ≤ 2 %", () => {
    expect(BUDGETS.maxFalseRejectionRate).toBeLessThanOrEqual(0.02);
    expect(BUDGETS.minFalseAcceptRate).toBeGreaterThanOrEqual(0.9);
  });
});
