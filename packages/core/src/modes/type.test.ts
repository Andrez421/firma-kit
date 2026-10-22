import { describe, expect, it } from "vitest";

import {
  layoutTypedName,
  type TextStyle,
  type TextMeasurer,
  type TypeOptions,
} from "./type.js";

// Medidor de mentira pero monótono: ancho proporcional a caracteres y tamaño.
// Lo importante del layout es que respete la caja, no cómo mide una fuente real.
const measurer: TextMeasurer = {
  measure(text: string, style: TextStyle) {
    return { width: text.length * style.size * 0.5, height: style.size };
  },
};

const CAJA = { width: 400, height: 120 };
const OPCIONES: TypeOptions = {
  family: "Caveat",
  maxSize: 72,
  minSize: 12,
};

describe("layoutEscribir", () => {
  it("rechaza el texto vacío o solo espacios", () => {
    expect(layoutTypedName("", CAJA, measurer)).toBeNull();
    expect(layoutTypedName("   ", CAJA, measurer)).toBeNull();
    expect(layoutTypedName("\n\t json", CAJA, measurer)).not.toBeNull();
  });

  it("un nombre corto usa el tamaño máximo y una sola línea", () => {
    const layout = layoutTypedName("Ana", CAJA, measurer, OPCIONES);
    expect(layout).not.toBeNull();
    expect(layout!.lines).toEqual(["Ana"]);
    expect(layout!.style.size).toBe(72);
    expect(layout!.style.family).toBe("Caveat");
  });

  it("reduce el tamaño hasta que el nombre cabe en el ancho", () => {
    const name = "María Fernanda Gómez Restrepo";
    const layout = layoutTypedName(name, CAJA, measurer, OPCIONES);
    expect(layout).not.toBeNull();
    expect(layout!.style.size).toBeLessThan(72);
    for (const linea of layout!.lines) {
      expect(measurer.measure(linea, layout!.style).width).toBeLessThanOrEqual(
        CAJA.width
      );
    }
    // Nada de perder letras por el camino.
    expect(layout!.lines.join(" ")).toBe(name);
  });

  it("nunca usa más líneas de las permitidas", () => {
    const layout = layoutTypedName(
      "José Antonio de la Cruz y Fernández",
      { width: 90, height: 200 },
      measurer,
      { ...OPCIONES, maxLines: 2 }
    );
    expect(layout).not.toBeNull();
    expect(layout!.lines.length).toBeLessThanOrEqual(2);
  });

  it("parte en líneas cuando así el nombre se ve más grande", () => {
    // Caja alta y estrecha: el límite es el ancho, no la altura, que es cuando
    // permitir dos líneas deja crecer el tamaño.
    const bounds = { width: 200, height: 400 };
    const unaLinea = layoutTypedName("Ana María Ruiz", bounds, measurer, {
      ...OPCIONES,
      maxLines: 1,
    })!;
    const dosLineas = layoutTypedName("Ana María Ruiz", bounds, measurer, {
      ...OPCIONES,
      maxLines: 2,
    })!;
    expect(dosLineas.lines.length).toBeGreaterThan(1);
    expect(dosLineas.style.size).toBeGreaterThan(unaLinea.style.size);
  });

  it("respeta el alto de la caja al apilar líneas", () => {
    const layout = layoutTypedName(
      "María Fernanda Gómez Restrepo",
      { width: 120, height: 60 },
      measurer,
      OPCIONES
    )!;
    const altoTotal = layout.lines.length * layout.lineHeight;
    expect(altoTotal).toBeLessThanOrEqual(60);
  });

  it("conserva tildes y eñes: no normaliza el nombre de la persona", () => {
    const name = "José Muñoz Peña";
    const layout = layoutTypedName(name, CAJA, measurer, OPCIONES)!;
    expect(layout.lines.join(" ")).toBe(name);
  });

  it("si el nombre no cabe ni al tamaño mínimo, no lo rechaza", () => {
    const name = "Maximiliano Alejandro Fernández de las Casas";
    const layout = layoutTypedName(
      name,
      { width: 40, height: 30 },
      measurer,
      OPCIONES
    );
    expect(layout).not.toBeNull();
    expect(layout!.style.size).toBe(OPCIONES.minSize);
  });

  it("es determinista", () => {
    const a = layoutTypedName("José Muñoz", CAJA, measurer, OPCIONES);
    const b = layoutTypedName("José Muñoz", CAJA, measurer, OPCIONES);
    expect(a).toEqual(b);
  });
});
