// Detección de formato por cabecera: la misma decisión en el navegador y en el
// servidor, sin decodificar la imagen ni tocar el DOM.
//
// El adaptador es quien decodifica (canvas en el navegador, sharp en el
// servidor) y quien aplica el tope de bytes; aquí solo se decide si el archivo
// es de un tipo que sabemos procesar, para que el motivo `unsupported_format`
// se explique igual en las dos puntas.

export type ImageFormat = "png" | "jpeg";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

function hasPrefix(
  bytes: Uint8Array | Uint8ClampedArray,
  signature: readonly number[]
): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Formato de la image según sus primeros bytes, o `null` si no es una image
 * que procesemos. Nunca lanza: una header truncada es simplemente un file
 * que no reconocemos.
 */
export function detectFormat(
  header: Uint8Array | Uint8ClampedArray
): ImageFormat | null {
  if (hasPrefix(header, PNG_SIGNATURE)) return "png";
  if (hasPrefix(header, JPEG_SIGNATURE)) return "jpeg";
  return null;
}
