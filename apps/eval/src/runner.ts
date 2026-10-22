// Medición del verificador sobre un corpus etiquetado.
//
// Devuelve la matriz de confusión, las tasas que importan y las latencias, y
// decide si el lote pasa. La decisión NO se toma aquí con números inventados: los
// presupuestos vienen de `BUDGETS` y se aplican tal cual.

import type { Bitmap, Verifier } from "@firma-kit/core";

import type { Budgets, CorpusEntry } from "./manifest.js";
import { muestrasParaCeroErrores, wilson, type Intervalo } from "./stats.js";

export type EvalCase = CorpusEntry;

export type EvalReport = {
  /** Qué verificador produjo el informe: "baseline-ink", "two-tier", … */
  verifier: string;
  /**
   * false cuando el lote incluye material sin licencia verificada: sus números
   * sirven para probar el arnés, no para fijar umbrales.
   */
  evidence: boolean;
  sensitive: number;
  total: number;
  truePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  falsePositives: number;
  /** Falsos rechazos sobre firmas: la métrica que no se negocia. */
  falseRejectionRate: number;
  /** Negativos aceptados por error, sobre el total de negativos. */
  falseAcceptRate: number;
  /** Negativos rechazados correctamente, sobre el total de negativos. */
  negativeAccuracy: number;
  /** Intervalo al 95 % de los falsos rechazos: sin esto el punto engaña. */
  falseRejectionInterval: Intervalo;
  /** Intervalo al 95 % de los falsos aceptados. */
  falseAcceptInterval: Intervalo;
  /** Intervalo al 95 % del acierto sobre negativos. */
  negativeAccuracyInterval: Intervalo;
  /** Positivos que harían falta para afirmar el presupuesto con cero errores. */
  positivesNeeded: number;
  latencyMs: { p50: number; p95: number; max: number };
  failures: Array<{ path: string; label: string; verdict: boolean }>;
  passed: boolean;
  reasons: string[];
};

export type RunEvalOptions = {
  /** Nombre del verificador evaluado; sin él el informe no es trazable. */
  verifierName: string;
  cases: EvalCase[];
  verifier: Verifier;
  loadImage: (ruta: string) => Promise<Bitmap>;
  budgets: Budgets;
  /** Reloj inyectable para que la latencia sea determinista en tests. */
  now?: () => number;
};

function percentil(valores: number[], q: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.floor(q * ordenados.length));
  return ordenados[indice]!;
}

export async function runEval(opciones: RunEvalOptions): Promise<EvalReport> {
  const {
    cases,
    verifier,
    loadImage,
    budgets,
    verifierName,
    now = () => Date.now(),
  } = opciones;

  if (cases.length === 0) {
    throw new Error("no hay casos: un informe vacío no dice nada");
  }
  const positivos = cases.filter((c) => c.label === "signature").length;
  const negativos = cases.length - positivos;
  if (positivos === 0 || negativos === 0) {
    // Con una sola clase no hay matriz: es el bloqueo conocido del proyecto.
    throw new Error(
      `el corpus necesita firmas y negativos (llegaron ${positivos} y ${negativos})`
    );
  }

  let truePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  const latencias: number[] = [];
  const failures: EvalReport["failures"] = [];

  for (const caso of cases) {
    const imagen = await loadImage(caso.path);
    const inicio = now();
    const veredicto = await verifier.verify(imagen);
    latencias.push(now() - inicio);

    const esFirma = caso.label === "signature";
    if (esFirma && veredicto.isSignature) truePositives++;
    else if (esFirma) {
      falseNegatives++;
      failures.push({ path: caso.path, label: caso.label, verdict: false });
    } else if (veredicto.isSignature) {
      falsePositives++;
      failures.push({ path: caso.path, label: caso.label, verdict: true });
    } else trueNegatives++;
  }

  const falseRejectionRate = falseNegatives / Math.max(1, positivos);
  const falseAcceptRate = falsePositives / Math.max(1, negativos);
  const negativeAccuracy = trueNegatives / Math.max(1, negativos);

  const reasons: string[] = [];
  if (falseRejectionRate > budgets.maxFalseRejectionRate) {
    reasons.push(
      `falsos rechazos ${(falseRejectionRate * 100).toFixed(1)} % > ${(budgets.maxFalseRejectionRate * 100).toFixed(0)} %`
    );
  }
  if (negativeAccuracy < budgets.minNegativeAccuracy) {
    reasons.push(
      `solo se rechaza ${(negativeAccuracy * 100).toFixed(1)} % de los negativos (mínimo ${(budgets.minNegativeAccuracy * 100).toFixed(0)} %)`
    );
  }

  const sinEvidencia = cases.filter((c) => c.source === "web-unverified").length;
  if (sinEvidencia > 0) {
    reasons.push(
      `${sinEvidencia} imágenes sin licencia verificada (web-unverified): el informe no es evidencia`
    );
  }

  return {
    verifier: verifierName,
    evidence: sinEvidencia === 0,
    sensitive: cases.filter((c) => c.sensitive).length,
    total: cases.length,
    truePositives,
    falseNegatives,
    trueNegatives,
    falsePositives,
    falseRejectionRate,
    falseAcceptRate,
    negativeAccuracy,
    falseRejectionInterval: wilson(falseNegatives, positivos),
    falseAcceptInterval: wilson(falsePositives, negativos),
    negativeAccuracyInterval: wilson(trueNegatives, negativos),
    positivesNeeded: muestrasParaCeroErrores(budgets.maxFalseRejectionRate),
    latencyMs: {
      p50: percentil(latencias, 0.5),
      p95: percentil(latencias, 0.95),
      max: Math.max(...latencias),
    },
    failures,
    // Una prueba de humo no pasa ni falla: informa. Si el lote no es evidencia,
    // mezclar "falla" con "no concluyente" engaña.
    passed: sinEvidencia === 0 && reasons.length === 0,
    reasons,
  };
}

/** Informe legible para la consola y para archivar en `docs/eval/`. */
export function formatReport(report: EvalReport): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
  return [
    `verificador: ${report.verifier}`,
    `evidencia: ${report.evidence ? "sí" : "no (incluye imágenes sin licencia verificada)"}`,
    report.sensitive ? `marcadas como sensibles: ${report.sensitive}` : "",
    `casos: ${report.total}`,
    `matriz: VP ${report.truePositives} · FN ${report.falseNegatives} · VN ${report.trueNegatives} · FP ${report.falsePositives}`,
    `falsos rechazos: ${pct(report.falseRejectionRate)} (95 % CI ${pct(report.falseRejectionInterval.lower)}–${pct(report.falseRejectionInterval.upper)})`,
    `negativos aceptados por error: ${pct(report.falseAcceptRate)} (95 % CI ${pct(report.falseAcceptInterval.lower)}–${pct(report.falseAcceptInterval.upper)})`,
    `negativos rechazados correctamente: ${pct(report.negativeAccuracy)} (95 % CI ${pct(report.negativeAccuracyInterval.lower)}–${pct(report.negativeAccuracyInterval.upper)})`,
    `latencia: p50 ${report.latencyMs.p50} ms · p95 ${report.latencyMs.p95} ms · max ${report.latencyMs.max} ms`,
    `positivos necesarios para afirmar el presupuesto de falsos rechazos con cero errores: ${report.positivesNeeded}`,
    report.passed ? "RESULTADO: pasa" : `RESULTADO: ${report.evidence ? "falla" : "no concluyente"} — ${report.reasons.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
