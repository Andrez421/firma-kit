// Cómo empieza un trazo. Vive aparte del componente porque es la decisión que cambia
// con `strokeLink`: ¿el trazo nuevo arranca donde acabó el anterior, o donde apoyó el
// puntero? Es una función pura, así que se prueba sin DOM y sin lienzo.
import type { StrokePoint } from "@firma-kit/core";

/**
 * Devuelve la lista de trazos con el nuevo trazo añadido.
 *
 * Con `enlazar` apagado (el comportamiento de siempre) el trazo nuevo empieza en el
 * punto donde se apoyó el dedo. Encendido, empieza en el último punto del trazo
 * anterior, así que ambos quedan unidos por una línea: sirve para firmar con varias
 * pasadas levantando el lápiz.
 */
export function startStroke(
  previos: StrokePoint[][],
  punto: StrokePoint,
  enlazar: boolean
): StrokePoint[][] {
  const ultimo = previos.at(-1)?.at(-1);
  const nuevo = enlazar && ultimo ? [ultimo, punto] : [punto];
  return [...previos, nuevo];
}

/** Orden de siempre de la barra, el que se pinta si no se pide otro. */
export const TOOLBAR_DEFAULT = ["undo", "redo", "erase", "fullscreen", "clear", "confirm"] as const;

export type ToolbarAction = (typeof TOOLBAR_DEFAULT)[number];
