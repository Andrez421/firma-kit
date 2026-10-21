// Puerto de verificación visual (fase 3). `core` lo declara y nunca lo
// implementa: los modelos pesan cientos de megabytes y sus licencias son suyas.
//
// La consecuencia de diseño es la privacidad: el verificador corre donde corre
// el llamador, así que la imagen de una cédula nunca sale de su infraestructura.

import type { Bitmap } from "./tipos.js";

/** Nivel que produjo el veredicto: gate barato (1) o segunda opinión (2). */
export type NivelVerificacion = 1 | 2;

export type Veredicto = {
  /** true si la imagen parece una firma manuscrita. */
  esFirma: boolean;
  /** 0..1. El umbral es del llamador: aquí no se decide nada por él. */
  confianza: number;
  nivel: NivelVerificacion;
};

/** Implementación de la verificación visual. `@firma-kit/verify` trae la suya. */
export type Verificador = {
  verificar: (imagen: Bitmap) => Promise<Veredicto>;
};
