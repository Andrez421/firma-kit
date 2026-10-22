// Manifiesto del corpus: una línea por imagen, con su etiqueta, su procedencia y
// su licencia.
//
// El corpus real (1 018 firmas) es dato personal y NO vive en este repositorio:
// se lee de un directorio externo por `FIRMA_KIT_EVAL_CORPUS`. Aquí solo viven
// fixtures sintéticos y, si alguna vez entra un dataset público, su licencia por
// archivo (ADR-012).

export type CorpusLabel = "signature" | "not_signature";

export type CorpusSource =
  | "synthetic"
  | "own"
  | "web-unverified"
  | (string & {});

export type CorpusEntry = {
  /** Ruta relativa al directorio del corpus. */
  path: string;
  label: CorpusLabel;
  /** De dónde salió: "synthetic", "own", "web-unverified" o una URL de dataset. */
  source: CorpusSource;
  /** Licencia del archivo, obligatoria si no es sintético. */
  licence: string;
  /**
   * El archivo contiene datos personales o sensibles (documento de identidad,
   * historia clínica, transacción de un tercero). Nunca debe salir del volumen
   * local ni aparecer en un informe publicable.
   */
  sensitive?: boolean;
};

/** Fuentes cuyas imágenes no se pueden redistribuir ni citar como evidencia. */
const SIN_EVIDENCIA = new Set(["web-unverified"]);

export class ManifestError extends Error {}

const ETIQUETAS: CorpusLabel[] = ["signature", "not_signature"];

/**
 * Valida el manifiesto. Un corpus mal etiquetado da métricas con buena cara y
 * conclusiones falsas, así que aquí se falla fuerte y temprano.
 */
export function parseManifest(valor: unknown): CorpusEntry[] {
  if (!Array.isArray(valor)) {
    throw new ManifestError("el manifiesto debe ser un arreglo de entradas");
  }
  if (valor.length === 0) {
    throw new ManifestError("el manifiesto está vacío");
  }

  const vistos = new Set<string>();
  return valor.map((entrada, indice) => {
    const donde = `entrada ${indice}`;
    if (typeof entrada !== "object" || entrada === null) {
      throw new ManifestError(`${donde}: no es un objeto`);
    }
    const e = entrada as Record<string, unknown>;

    const ruta = e["path"];
    if (typeof ruta !== "string" || ruta.trim() === "") {
      throw new ManifestError(`${donde}: falta "path"`);
    }
    if (ruta.startsWith("/") || ruta.includes("..")) {
      // El corpus se lee dentro de su directorio: nada de rutas absolutas ni
      // escapes con `..`.
      throw new ManifestError(`${donde}: "path" debe ser relativo al corpus (${ruta})`);
    }
    if (vistos.has(ruta)) {
      throw new ManifestError(`${donde}: "${ruta}" está repetido`);
    }
    vistos.add(ruta);

    const etiqueta = e["label"];
    if (!ETIQUETAS.includes(etiqueta as CorpusLabel)) {
      throw new ManifestError(
        `${donde}: "label" debe ser ${ETIQUETAS.join(" o ")}, llegó ${String(etiqueta)}`
      );
    }

    const fuente = e["source"];
    if (typeof fuente !== "string" || fuente.trim() === "") {
      throw new ManifestError(`${donde}: falta "source"`);
    }

    const licencia = e["licence"];
    if (typeof licencia !== "string" || licencia.trim() === "") {
      throw new ManifestError(`${donde}: falta "licence"`);
    }
    // `web-unverified` es la etiqueta explícita para "no sé de dónde salió":
    // se admite para pruebas de humo, pero sólo con licencia "unknown", y el
    // informe sale marcado como no-evidencia.
    if (SIN_EVIDENCIA.has(fuente)) {
      if (licencia !== "unknown") {
        throw new ManifestError(
          `${donde}: "${fuente}" exige licence "unknown"; si verificaste la licencia, usa su fuente real`
        );
      }
    } else if (fuente !== "synthetic" && licencia === "unknown") {
      throw new ManifestError(
        `${donde}: una fuente real necesita licencia verificada, no "unknown"`
      );
    }

    const sensitivo = e["sensitive"];
    if (sensitivo !== undefined && typeof sensitivo !== "boolean") {
      throw new ManifestError(`${donde}: "sensitive" debe ser booleano`);
    }

    return {
      path: ruta,
      label: etiqueta as CorpusLabel,
      source: fuente,
      licence: licencia,
      ...(sensitivo === undefined ? {} : { sensitive: sensitivo }),
    };
  });
}

/** Presupuestos de calidad. La métrica que no se negocia manda. */
export type Budgets = {
  /** Falsos rechazos sobre firmas reales. 1-2 % es el techo histórico. */
  maxFalseRejectionRate: number;
  /** Falsos aceptados sobre negativos. */
  minFalseAcceptRate: number;
};

export const BUDGETS: Budgets = {
  maxFalseRejectionRate: 0.02,
  minFalseAcceptRate: 0.9,
};
