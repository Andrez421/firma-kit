"use client";

// `"use client"` es la primera sentencia a propósito: todo el componente usa
// canvas, archivos y puntero, así que no tiene sentido en un Server Component.
// Para leer el contrato desde el servidor existe `@firma-kit/react/server`.

export { SignatureField, availableModes } from "./SignatureField.js";
export type { SignatureFieldHandle, SignatureFieldProps, ToolbarAction } from "./SignatureField.js";
export { createCanvasPngEncoder, toPngBlob } from "./encoder.js";
export {
  loadFont,
  createCanvasTextMeasurer,
  createCanvasTextRasterizer,
  fontFamily,
} from "./rasterizer.js";
export { TYPE_FONTS, MESSAGES_ES, rejectionMessage } from "@firma-kit/core";
export type {
  TextStyle,
  Signature,
  TextMeasurer,
  SignatureMode,
  RejectionReason,
  SignatureResult,
  TextRasterizer,
  Verifier,
} from "@firma-kit/core";
