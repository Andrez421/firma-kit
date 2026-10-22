// Incertidumbre de una métrica medida sobre pocas muestras.
//
// Un 6,9 % de falsos aceptados sobre 101 negativos no significa 6,9 %: con esa
// muestra el intervalo real es ancho. Reportar el punto sin el intervalo es la
// forma más fácil de que alguien calibre contra ruido.

export type Intervalo = { lower: number; upper: number };

/**
 * Intervalo de Wilson al 95 % para una proporción.
 *
 * Se usa Wilson y no la aproximación normal porque con muestras pequeñas y
 * proporciones cerca de 0 o 1 (justo nuestro caso: rechazos ~0 %, aceptados
 * ~93 %) la normal da intervalos que se salen de [0, 1] y mienten.
 */
export function wilson(exitos: number, total: number, z = 1.96): Intervalo {
  if (total <= 0) return { lower: 0, upper: 1 };
  const p = exitos / total;
  const denominador = 1 + (z * z) / total;
  const centro = (p + (z * z) / (2 * total)) / denominador;
  const margen =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
    denominador;
  return {
    lower: Math.max(0, centro - margen),
    upper: Math.min(1, centro + margen),
  };
}

/**
 * Cuántas muestras hacen falta para afirmar que una tasa está por debajo de un
 * presupuesto con el 95 % de confianza, usando la regla de tres conservadora:
 * cero errores en N muestras da un límite superior aproximado de 3/N.
 *
 * Con el presupuesto de 2 % de falsos rechazos, esto responde la pregunta que
 * importa: «¿cuántos positivos necesito para poder afirmarlo?».
 */
export function muestrasParaCeroErrores(presupuesto: number): number {
  if (presupuesto <= 0 || presupuesto >= 1) return Infinity;
  return Math.ceil(3 / presupuesto);
}
