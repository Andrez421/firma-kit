// Contrato público del módulo de firma. Todo lo demás (React, servidor,
// modelos) se construye sobre estos tipos.

import type { InkReason } from "./ink/pixels.js";
import type { Verifier } from "./verifier.js";

/** Las cuatro formas de sign. */
export type SignatureMode = "draw" | "type" | "upload" | "camera";

/** Motivo por el que una signature no se acepta. */
/** Idioma de los messages de rejection: inglés primero, español completo. */
export type Locale = "en" | "es";

export type RejectionReason =
  | InkReason // unreadable | no_ink | dark_background | not_a_signature | noise
  | "empty" // el lienzo está en blanco o el texto de "escribir" está vacío
  | "too_heavy" // supera el tope de bytes antes de limpiar
  | "unsupported_format" // ni PNG ni JPEG
  | "font_unavailable"; // la cursiva no cargó, así que no se pudo escribir

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
 * dependencia de image, así que entra por aquí: `canvas.toBlob` en el
 * navegador, sharp en el servidor. `@firma-kit/react` trae una implementación.
 */
export type PngEncoder = (image: Bitmap) => Promise<Uint8Array> | Uint8Array;

/** Signature lista para guardar: siempre PNG opaco (tinta sobre blanco). */
export type Signature = {
  mode: SignatureMode;
  /** PNG ya codificado. `Uint8Array` sirve igual en Node y en el navegador. */
  png: Uint8Array;
  width: number;
  height: number;
  /** ISO 8601, para trazabilidad en el registro. */
  createdAt: string;
  /** true si el pipeline tuvo que realzar niveles (foto plana). */
  enhanced?: boolean;
};

export type SignatureResult =
  | { ok: true; signature: Signature }
  | { ok: false; reason: RejectionReason; message: string };

/** Opciones compartidas por las cuatro formas de sign. */
export type SignatureOptions = {
  /** Ancho máximo del PNG final. Por defecto 900 (celda impresa ~90px a 300dpi). */
  maxWidth?: number;
  /** Lado mayor que se analiza. Por defecto 1200 (memoria del móvil). */
  maxAnalysisSide?: number;
  /**
   * Verifier visual opcional (fase 3). Su ausencia significa "no verificar":
   * no hay un booleano aparte que pueda contradecirlo.
   */
  verifier?: Verifier;
  /** Sobrescribe el message de un reason de rejection concreto. */
  messages?: Partial<Record<RejectionReason, string>>;
  /** Idioma de los messages de rejection. Por defecto `es`. */
  locale?: Locale;
};
