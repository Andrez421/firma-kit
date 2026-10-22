// Umbrales de decisión, versionados a propósito.
//
// ADR-011: cambiar un umbral exige el reporte de evaluación archivado en
// `docs/eval/`, porque un número ajustado a ojo es indistinguible de uno
// calibrado. El test `thresholds.test.ts` fija los valores para que el cambio
// sea consciente y no un efecto colateral de otro refactor.
//
// Los valores son PROVISIONALES: la métrica que manda es falsos rechazos ≤ 1-2 %
// sobre firmas reales, y no se puede calibrar sin 30-50 negativos reales. Hasta
// entonces el sesgo es deliberado: ante la duda, aceptar (un falso rechazo deja
// a una persona sin poder firmar; un falso aceptado se detecta después).

export const THRESHOLDS_VERSION = "1";

export type Thresholds = {
  /** Puntuación del gate a partir de la cual es firma, sin segunda opinión. */
  gateAccept: number;
  /** Puntuación del gate en o por debajo de la cual no lo es. */
  gateReject: number;
};

export const THRESHOLDS: Thresholds = {
  gateAccept: 0.72,
  gateReject: 0.35,
};
