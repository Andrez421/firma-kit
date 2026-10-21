// Spanish messages: the language the person signing sees today.
//
// The codes in `RejectionReason` are the contract; these texts are copy. Keeping
// them apart is what allows `en.ts` to exist without touching the pipeline.

import type { RejectionReason } from "../types.js";

export const MESSAGES_ES: Record<RejectionReason, string> = {
  unreadable: "No pudimos leer la imagen. Sube un PNG o JPG de tu firma.",
  no_ink:
    "No encontramos el trazo de la firma. Acércate y encuadra solo la firma sobre papel blanco.",
  dark_background:
    "La foto tiene el fondo oscuro o muy sombreado. Repítela sobre papel blanco, con luz uniforme.",
  not_a_signature:
    "La imagen no parece una firma (por ejemplo, la foto de un documento). Sube o toma una foto de la firma.",
  noise:
    "El fondo tiene demasiada textura (trama, mármol, cuadrícula) y no se puede separar de la firma. Repítela sobre papel liso.",
  empty: "El lienzo está vacío. Dibuja o escribe tu firma antes de continuar.",
  too_heavy:
    "La imagen pesa demasiado para procesarla. Prueba con una foto más pequeña o recórtala.",
  unsupported_format:
    "Solo aceptamos PNG o JPG. Convierte la imagen a uno de esos formatos y vuelve a intentarlo.",
  font_unavailable:
    "No pudimos cargar la letra para escribir tu firma. Espera un momento y vuelve a intentarlo, o elige otra letra.",
};
