// Mensajes de usuario en español neutro: lo único que ve la persona que firma.
//
// Los textos viven aquí y no dentro del pipeline para poder añadir `en.ts` sin
// tocar la maquinaria. `INK_MESSAGE` sigue siendo la tabla del pipeline de tinta
// y esta la extiende: un motivo nuevo sin mensaje rompe la compilación.

import { INK_MESSAGE } from "../tinta/pixeles.js";
import type { MotivoRechazo } from "../tipos.js";

export const MENSAJES_ES: Record<MotivoRechazo, string> = {
  ...INK_MESSAGE,
  vacia: "El lienzo está vacío. Dibuja o escribe tu firma antes de continuar.",
  muy_pesada:
    "La imagen pesa demasiado para procesarla. Prueba con una foto más pequeña o recórtala.",
  formato_no_soportado:
    "Solo aceptamos PNG o JPG. Convierte la imagen a uno de esos formatos y vuelve a intentarlo.",
  fuente_no_disponible:
    "No pudimos cargar la letra para escribir tu firma. Espera un momento y vuelve a intentarlo, o elige otra letra.",
};

/**
 * Mensaje para un motivo de rechazo, respetando el override del llamador.
 *
 * Un override vacío se ignora a propósito: un mensaje en blanco es peor que el
 * mensaje por defecto, porque deja al usuario sin saber qué corregir.
 */
export function mensajeRechazo(
  motivo: MotivoRechazo,
  mensajes?: Partial<Record<MotivoRechazo, string>>
): string {
  const propio = mensajes?.[motivo]?.trim();
  return propio ? propio : MENSAJES_ES[motivo];
}
