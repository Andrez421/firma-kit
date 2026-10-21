import { describe, expect, it } from "vitest";

import { MESSAGES, MESSAGES_EN, MESSAGES_ES, rejectionMessage } from "./index.js";
import type { RejectionReason } from "../types.js";

// La lista existe para que añadir un motivo sin mensaje rompa un test y no la
// experiencia de una persona: el `Record<RejectionReason, string>` ya lo impide
// en compilación, esto lo impide también en ejecución, en los dos idiomas.
const REASONS: RejectionReason[] = [
  "unreadable",
  "no_ink",
  "dark_background",
  "not_a_signature",
  "noise",
  "empty",
  "too_heavy",
  "unsupported_format",
  "font_unavailable",
];

describe("messages", () => {
  it("explica cada motivo de rechazo en inglés y en español", () => {
    for (const reason of REASONS) {
      for (const locale of ["en", "es"] as const) {
        const message = MESSAGES[locale][reason];
        expect(message.length).toBeGreaterThan(10);
        expect(message).not.toBe(reason);
      }
      // Los dos idiomas dicen lo mismo: si son idénticos, falta traducción.
      expect(MESSAGES.en[reason]).not.toBe(MESSAGES.es[reason]);
    }
  });

  it("usa el inglés por defecto: la API es primariamente inglesa", () => {
    for (const reason of REASONS) {
      expect(rejectionMessage(reason)).toBe(MESSAGES_EN[reason]);
    }
  });

  it("devuelve el mensaje del idioma pedido", () => {
    for (const reason of REASONS) {
      expect(rejectionMessage(reason, "es")).toBe(MESSAGES_ES[reason]);
    }
  });

  it("respeta el override del llamador sin tocar los demás motivos", () => {
    const messages = { no_ink: "Acércate un poco más." };
    expect(rejectionMessage("no_ink", "es", messages)).toBe("Acércate un poco más.");
    expect(rejectionMessage("dark_background", "es", messages)).toBe(
      MESSAGES_ES.dark_background
    );
  });

  it("ignora un override vacío en vez de mostrar un mensaje en blanco", () => {
    expect(rejectionMessage("noise", "es", { noise: "   " })).toBe(
      MESSAGES_ES.noise
    );
  });
});
