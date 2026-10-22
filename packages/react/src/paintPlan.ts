// Decide cómo repintar el lienzo del modo dibujar. Existe por un problema medido:
// re-rasterizar el lienzo completo en cada `pointermove` cuesta el cuadrado de los
// puntos del trazo (1 000 puntos ≈ 2.2 s de trabajo repartidos en tirones), porque
// `rasterizeStroke` recorre el lienzo entero y no solo el segmento nuevo.

export type EstadoDelLienzo = {
  /** Trazos ya registrados. */
  trazos: number;
  /** Puntos sumados de todos los trazos. */
  puntos: number;
  /** Cambia al soltar el puntero: obliga a una pasada exacta. */
  finalizado: number;
  /** Firma de las opciones del trazo (grosores, tinta). */
  estilo: string;
};

export type PlanDePintado = "completo" | "segmento" | "nada";

/**
 * Elige entre la pasada exacta (rasterizador puro), el segmento nuevo
 * (aproximado, barato) o no pintar. Cualquier cambio estructural —deshacer,
 * rehacer, borrar, limpiar, cambiar de grosor— pide la pasada exacta: la
 * aproximación solo se permite mientras el trazo está en curso, y se corrige al
 * soltar el puntero.
 */
export function planDePintado(
  previo: EstadoDelLienzo,
  actual: EstadoDelLienzo
): PlanDePintado {
  if (previo.estilo !== actual.estilo) return "completo";
  if (previo.finalizado !== actual.finalizado) return "completo";
  if (previo.trazos !== actual.trazos) return "completo";
  if (previo.puntos === actual.puntos) return "nada";
  if (actual.puntos === previo.puntos + 1) return "segmento";
  return "completo";
}
