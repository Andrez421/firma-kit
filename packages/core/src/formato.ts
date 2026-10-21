// Detección de formato por cabecera: la misma decisión en el navegador y en el
// servidor, sin decodificar la imagen ni tocar el DOM.
//
// El adaptador es quien decodifica (canvas en el navegador, sharp en el
// servidor) y quien aplica el tope de bytes; aquí solo se decide si el archivo
// es de un tipo que sabemos procesar, para que el motivo `formato_no_soportado`
// se explique igual en las dos puntas.

export type FormatoImagen = "png" | "jpeg";

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const FIRMA_JPEG = [0xff, 0xd8, 0xff] as const;

function empiezaPor(
  bytes: Uint8Array | Uint8ClampedArray,
  firma: readonly number[]
): boolean {
  if (bytes.length < firma.length) return false;
  for (let i = 0; i < firma.length; i++) {
    if (bytes[i] !== firma[i]) return false;
  }
  return true;
}

/**
 * Formato de la imagen según sus primeros bytes, o `null` si no es una imagen
 * que procesemos. Nunca lanza: una cabecera truncada es simplemente un archivo
 * que no reconocemos.
 */
export function detectarFormato(
  cabecera: Uint8Array | Uint8ClampedArray
): FormatoImagen | null {
  if (empiezaPor(cabecera, FIRMA_PNG)) return "png";
  if (empiezaPor(cabecera, FIRMA_JPEG)) return "jpeg";
  return null;
}
