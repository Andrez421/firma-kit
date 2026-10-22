import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { SignatureField } from "./SignatureField.js";

afterEach(cleanup);

/**
 * Reglas de axe que sí se pueden evaluar en jsdom. `color-contrast` necesita
 * layout y pintado, así que aquí no mide nada: el contraste se verifica en un
 * navegador real (Playwright) y en el playground.
 */
async function violaciones(contenedor: HTMLElement) {
  const resultado = await axe.run(contenedor, {
    rules: { "color-contrast": { enabled: false } },
  });
  return resultado.violations.map((v) => `${v.id}: ${v.help}`);
}

describe("accesibilidad", () => {
  it("el medidor detecta violaciones cuando las hay (control negativo)", async () => {
    // Sin este control, un axe mal configurado devolvería [] siempre y los
    // tests de abajo no probarían nada.
    const { container } = render(
      <div>
        <button></button>
        <input />
      </div>
    );
    const encontradas = await violaciones(container);
    expect(encontradas.length).toBeGreaterThan(0);
  });

  it("no tiene violaciones con el modo dibujar", async () => {
    const { container } = render(<SignatureField />);
    expect(await violaciones(container)).toEqual([]);
  });

  it("no tiene violaciones con el modo escribir disponible", async () => {
    const { container } = render(<SignatureField name="Ana Muñoz" />);
    expect(await violaciones(container)).toEqual([]);
  });

  it("no tiene violaciones en el modo subir, con su input de archivo", async () => {
    const { container, getByRole } = render(
      <SignatureField modes={["upload"]} />
    );
    getByRole("tab", { name: "Upload" }).focus();
    expect(await violaciones(container)).toEqual([]);
  });

  it("no tiene violaciones en el tema oscuro", async () => {
    const { container } = render(<SignatureField theme="dark" />);
    expect(await violaciones(container)).toEqual([]);
  });

  it("no tiene violaciones mostrando un rechazo", async () => {
    const { container, getByRole } = render(
      <SignatureField encoder={async () => new Uint8Array([1])} />
    );
    getByRole("button", { name: "Use this signature" }).click();
    await new Promise((r) => setTimeout(r, 50));
    expect(await violaciones(container)).toEqual([]);
  });
});
