// Entrada para Server Components: solo tipos, sin React y sin DOM.
//
// `import type { Firma } from "@firma-kit/react/server"` funciona en un RSC
// porque este módulo no tiene efectos: nada de canvas, nada de `"use client"`.

export type {
  Bitmap,
  Firma,
  ModoFirma,
  MotivoRechazo,
  OpcionesFirma,
  ResultadoFirma,
  Veredicto,
  Verificador,
} from "@firma-kit/core";
