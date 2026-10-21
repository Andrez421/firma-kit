"use client";

// `"use client"` es la primera sentencia a propósito: todo el componente usa
// canvas, archivos y puntero, así que no tiene sentido en un Server Component.
// Para leer el contrato desde el servidor existe `@firma-kit/react/server`.

export { FirmaField, modosDisponibles } from "./FirmaField.js";
export type { FirmaFieldHandle, FirmaFieldProps } from "./FirmaField.js";
export { createCanvasPngEncoder, toPngBlob } from "./encoder.js";
export {
  cargarFuente,
  createCanvasTextMeasurer,
  createCanvasTextRasterizer,
  familiaFont,
} from "./rasterizer.js";
export { FUENTES_ESCRIBIR, MENSAJES_ES, mensajeRechazo } from "@firma-kit/core";
export type {
  EstiloTexto,
  Firma,
  MedidorTexto,
  ModoFirma,
  MotivoRechazo,
  ResultadoFirma,
  TextRasterizer,
  Verificador,
} from "@firma-kit/core";
