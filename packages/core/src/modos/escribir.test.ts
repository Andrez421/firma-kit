import { describe, expect, it } from "vitest";

import {
  layoutEscribir,
  type EstiloTexto,
  type MedidorTexto,
  type OpcionesEscribir,
} from "./escribir.js";

// Medidor de mentira pero monótono: ancho proporcional a caracteres y tamaño.
// Lo importante del layout es que respete la caja, no cómo mide una fuente real.
const medidor: MedidorTexto = {
  medir(texto: string, estilo: EstiloTexto) {
    return { ancho: texto.length * estilo.tamano * 0.5, alto: estilo.tamano };
  },
};

const CAJA = { width: 400, height: 120 };
const OPCIONES: OpcionesEscribir = {
  familia: "Caveat",
  tamanoMaximo: 72,
  tamanoMinimo: 12,
};

describe("layoutEscribir", () => {
  it("rechaza el texto vacío o solo espacios", () => {
    expect(layoutEscribir("", CAJA, medidor)).toBeNull();
    expect(layoutEscribir("   ", CAJA, medidor)).toBeNull();
    expect(layoutEscribir("\n\t json", CAJA, medidor)).not.toBeNull();
  });

  it("un nombre corto usa el tamaño máximo y una sola línea", () => {
    const layout = layoutEscribir("Ana", CAJA, medidor, OPCIONES);
    expect(layout).not.toBeNull();
    expect(layout!.lineas).toEqual(["Ana"]);
    expect(layout!.estilo.tamano).toBe(72);
    expect(layout!.estilo.familia).toBe("Caveat");
  });

  it("reduce el tamaño hasta que el nombre cabe en el ancho", () => {
    const nombre = "María Fernanda Gómez Restrepo";
    const layout = layoutEscribir(nombre, CAJA, medidor, OPCIONES);
    expect(layout).not.toBeNull();
    expect(layout!.estilo.tamano).toBeLessThan(72);
    for (const linea of layout!.lineas) {
      expect(medidor.medir(linea, layout!.estilo).ancho).toBeLessThanOrEqual(
        CAJA.width
      );
    }
    // Nada de perder letras por el camino.
    expect(layout!.lineas.join(" ")).toBe(nombre);
  });

  it("nunca usa más líneas de las permitidas", () => {
    const layout = layoutEscribir(
      "José Antonio de la Cruz y Fernández",
      { width: 90, height: 200 },
      medidor,
      { ...OPCIONES, lineasMaximas: 2 }
    );
    expect(layout).not.toBeNull();
    expect(layout!.lineas.length).toBeLessThanOrEqual(2);
  });

  it("parte en líneas cuando así el nombre se ve más grande", () => {
    // Caja alta y estrecha: el límite es el ancho, no la altura, que es cuando
    // permitir dos líneas deja crecer el tamaño.
    const caja = { width: 200, height: 400 };
    const unaLinea = layoutEscribir("Ana María Ruiz", caja, medidor, {
      ...OPCIONES,
      lineasMaximas: 1,
    })!;
    const dosLineas = layoutEscribir("Ana María Ruiz", caja, medidor, {
      ...OPCIONES,
      lineasMaximas: 2,
    })!;
    expect(dosLineas.lineas.length).toBeGreaterThan(1);
    expect(dosLineas.estilo.tamano).toBeGreaterThan(unaLinea.estilo.tamano);
  });

  it("respeta el alto de la caja al apilar líneas", () => {
    const layout = layoutEscribir(
      "María Fernanda Gómez Restrepo",
      { width: 120, height: 60 },
      medidor,
      OPCIONES
    )!;
    const altoTotal = layout.lineas.length * layout.interlineado;
    expect(altoTotal).toBeLessThanOrEqual(60);
  });

  it("conserva tildes y eñes: no normaliza el nombre de la persona", () => {
    const nombre = "José Muñoz Peña";
    const layout = layoutEscribir(nombre, CAJA, medidor, OPCIONES)!;
    expect(layout.lineas.join(" ")).toBe(nombre);
  });

  it("si el nombre no cabe ni al tamaño mínimo, no lo rechaza", () => {
    const nombre = "Maximiliano Alejandro Fernández de las Casas";
    const layout = layoutEscribir(
      nombre,
      { width: 40, height: 30 },
      medidor,
      OPCIONES
    );
    expect(layout).not.toBeNull();
    expect(layout!.estilo.tamano).toBe(OPCIONES.tamanoMinimo);
  });

  it("es determinista", () => {
    const a = layoutEscribir("José Muñoz", CAJA, medidor, OPCIONES);
    const b = layoutEscribir("José Muñoz", CAJA, medidor, OPCIONES);
    expect(a).toEqual(b);
  });
});
