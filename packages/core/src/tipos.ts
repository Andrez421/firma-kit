// Contrato público del módulo de firma. Todo lo demás (React, servidor,
// modelos) se construye sobre estos tipos.

import type { InkReason } from "./tinta/pixeles.js";
import type { Verificador } from "./verificador.js";

/** Las cuatro formas de firmar. */
export type ModoFirma = "dibujar" | "escribir" | "subir" | "foto";

/** Motivo por el que una firma no se acepta. */
export type MotivoRechazo =
  | InkReason // ilegible | sin_tinta | fondo_oscuro | no_es_firma | ruido
  | "vacia" // el lienzo está en blanco o el texto de "escribir" está vacío
  | "muy_pesada" // supera el tope de bytes antes de limpiar
  | "formato_no_soportado" // ni PNG ni JPEG
  | "fuente_no_disponible"; // la cursiva no cargó, así que no se pudo escribir

/**
 * Imagen RGBA ya decodificada: `ImageData` en el navegador, buffer de sharp en
 * el servidor. `core` no decodifica ni crea canvas; solo consume esta forma.
 */
export type Bitmap = {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
};

/**
 * Codifica RGBA opaco a PNG. `core` no puede hacerlo sin canvas o sin una
 * dependencia de imagen, así que entra por aquí: `canvas.toBlob` en el
 * navegador, sharp en el servidor. `@firma-kit/react` trae una implementación.
 */
export type EncodePng = (imagen: Bitmap) => Promise<Uint8Array> | Uint8Array;

/** Firma lista para guardar: siempre PNG opaco (tinta sobre blanco). */
export type Firma = {
  modo: ModoFirma;
  /** PNG ya codificado. `Uint8Array` sirve igual en Node y en el navegador. */
  png: Uint8Array;
  ancho: number;
  alto: number;
  /** ISO 8601, para trazabilidad en el registro. */
  creadaEn: string;
  /** true si el pipeline tuvo que realzar niveles (foto plana). */
  realzada?: boolean;
};

export type ResultadoFirma =
  | { ok: true; firma: Firma }
  | { ok: false; motivo: MotivoRechazo; mensaje: string };

/** Opciones compartidas por las cuatro formas de firmar. */
export type OpcionesFirma = {
  /** Ancho máximo del PNG final. Por defecto 900 (celda impresa ~90px a 300dpi). */
  anchoMaximo?: number;
  /** Lado mayor que se analiza. Por defecto 1200 (memoria del móvil). */
  ladoAnalisis?: number;
  /**
   * Verificador visual opcional (fase 3). Su ausencia significa "no verificar":
   * no hay un booleano aparte que pueda contradecirlo.
   */
  verificador?: Verificador;
  /** Sobrescribe el mensaje de un motivo de rechazo concreto. */
  mensajes?: Partial<Record<MotivoRechazo, string>>;
  /** Idioma de los mensajes de rechazo. Por defecto `es`. */
  idioma?: "es";
};
