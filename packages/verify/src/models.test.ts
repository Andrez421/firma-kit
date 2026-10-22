import { describe, expect, it } from "vitest";

import { MODELS, modelsDir } from "./models.js";

describe("catálogo de modelos", () => {
  it("todo peso descargable tiene SHA-256 fijado", () => {
    // Un peso sin hash es un peso sin procedencia verificable: si aparece uno,
    // es que alguien añadió un modelo sin pasar por la descarga comprobada.
    const sinHash = MODELS.flatMap((spec) => spec.files)
      .filter((file) => file.sha256 === null)
      .map((file) => file.name);
    expect(sinHash).toEqual([]);
  });

  it("cada hash tiene forma de SHA-256 y cada URL es https", () => {
    for (const spec of MODELS) {
      expect(spec.files.length).toBeGreaterThan(0);
      for (const file of spec.files) {
        expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(file.url.startsWith("https://")).toBe(true);
        expect(file.bytes).toBeGreaterThan(1_000_000);
      }
    }
  });

  it("declara licencia por modelo y no usa nombres repetidos", () => {
    const nombres = new Set<string>();
    for (const spec of MODELS) {
      expect(spec.licence.length).toBeGreaterThan(3);
      for (const file of spec.files) {
        expect(nombres.has(file.name)).toBe(false);
        nombres.add(file.name);
      }
    }
  });

  it("el directorio sale del entorno, con un valor por defecto", () => {
    expect(modelsDir({ FIRMA_KIT_MODULES_DIR: "/volumen/modelos" })).toBe("/volumen/modelos");
    expect(modelsDir({})).toBe("./modules");
  });
});
