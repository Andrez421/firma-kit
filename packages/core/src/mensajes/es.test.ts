import { describe, expect, it } from "vitest";

import { MENSAJES_ES, mensajeRechazo } from "./es.js";
import { INK_MESSAGE } from "../tinta/pixeles.js";
import type { MotivoRechazo } from "../tipos.js";

// La lista existe para que añadir un motivo sin mensaje rompa un test y no la
// experiencia de un usuario: el `Record<MotivoRechazo, string>` ya lo impide en
// compilación, esto lo impide también en ejecución.
const MOTIVOS: MotivoRechazo[] = [
  "ilegible",
  "sin_tinta",
  "fondo_oscuro",
  "no_es_firma",
  "ruido",
  "vacia",
  "muy_pesada",
  "formato_no_soportado",
  "fuente_no_disponible",
];

describe("MENSAJES_ES", () => {
  it("explica cada motivo de rechazo con un mensaje propio", () => {
    for (const motivo of MOTIVOS) {
      const mensaje = MENSAJES_ES[motivo];
      expect(mensaje.length).toBeGreaterThan(10);
      expect(mensaje).not.toBe(motivo);
    }
  });

  it("no inventa un texto distinto al del pipeline de tinta", () => {
    for (const [motivo, mensaje] of Object.entries(INK_MESSAGE)) {
      expect(MENSAJES_ES[motivo as MotivoRechazo]).toBe(mensaje);
    }
  });
});

describe("mensajeRechazo", () => {
  it("devuelve el mensaje por defecto de cada motivo", () => {
    for (const motivo of MOTIVOS) {
      expect(mensajeRechazo(motivo)).toBe(MENSAJES_ES[motivo]);
    }
  });

  it("respeta el override del llamador sin tocar los demás motivos", () => {
    const mensajes = { sin_tinta: "Acércate un poco más." };
    expect(mensajeRechazo("sin_tinta", mensajes)).toBe("Acércate un poco más.");
    expect(mensajeRechazo("fondo_oscuro", mensajes)).toBe(
      MENSAJES_ES.fondo_oscuro
    );
  });

  it("ignora un override vacío en vez de mostrar un mensaje en blanco", () => {
    expect(mensajeRechazo("ruido", { ruido: "   " })).toBe(MENSAJES_ES.ruido);
  });
});
