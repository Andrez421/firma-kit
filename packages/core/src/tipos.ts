// Contrato público del módulo de firma. Todo lo demás (React, servidor,
// modelos) se construye sobre estos tipos.

import type { InkReason } from "./tinta/pixeles.js";

/** Las cuatro formas de firmar. */
export type ModoFirma = "dibujar" | "escribir" | "subir" | "foto";

/** Motivo por el que una firma no se acepta. */
export type MotivoRechazo =
  | InkReason // ilegible | sin_tinta | fondo_oscuro | no_es_firma | ruido
  | "vacia" // el lienzo está en blanco o el texto de "escribir" está vacío
  | "muy_pesada" // supera el tope de bytes antes de limpiar
  | "formato_no_soportado"; // ni PNG ni JPEG

/** Firma lista para guardar: siempre PNG opaco (tinta sobre blanco). */
export type Firma = {
  modo: ModoFirma;
  png: Blob;
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
  /** Si la verificación visual está disponible, úsala en subir/foto. */
  verificarImagen?: boolean;
  /** Idioma de los mensajes de rechazo. Por defecto `es`. */
  idioma?: "es";
};
