// Punto de entrada del arnés: lee el corpus, mide, imprime y devuelve código de
// salida 1 si el lote no cumple los presupuestos.
//
// El corpus real vive fuera del repositorio (ADR-012):
//   FIRMA_KIT_EVAL_CORPUS=/ruta/al/corpus pnpm --filter @firma-kit/eval eval
//
// Los modelos tampoco están en el repo: hay que traerlos antes con
//   firma-kit-verify models pull

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createCanvas, loadImage as cargarImagen, type Image } from "@napi-rs/canvas";
import type { Bitmap, Verifier } from "@firma-kit/core";
import { createTwoTierVerifier } from "@firma-kit/verify";

import { createInkPipelineVerifier } from "./baseline.js";

import { BUDGETS, parseManifest, type CorpusEntry } from "./manifest.js";
import { formatReport, runEval } from "./runner.js";

const corpus = process.env["FIRMA_KIT_EVAL_CORPUS"];
if (!corpus) {
  console.error(
    "Falta FIRMA_KIT_EVAL_CORPUS. El corpus real es dato personal y no vive en el repositorio (ADR-012)."
  );
  process.exit(2);
}

async function leerBitmap(ruta: string): Promise<Bitmap> {
  const imagen: Image = await cargarImagen(path.join(corpus!, ruta));
  const canvas = createCanvas(imagen.width, imagen.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imagen, 0, 0);
  const datos = ctx.getImageData(0, 0, imagen.width, imagen.height);
  return { data: datos.data, width: imagen.width, height: imagen.height };
}

/**
 * Verificador real. Hoy queda deliberadamente sin modelos cargados: el arnés
 * funciona y mide, pero el gate se inyecta cuando existan los pesos.
 */
function verificadorDesdeModelos(): Verifier {
  return createTwoTierVerifier({
    gate: {
      score: async () => {
        throw new Error(
          "El gate todavía no carga modelos. Trae los pesos con `firma-kit-verify models pull` y conecta el runner en fase 3."
        );
      },
    },
  });
}

// `--baseline` mide el pipeline de tinta, que no necesita modelos. Sin el flag
// se intenta el gate de dos niveles, que hoy lanza porque faltan los pesos.
const usarBaseline = process.argv.includes("--baseline");
const verifier = usarBaseline ? createInkPipelineVerifier() : verificadorDesdeModelos();
const verifierName = usarBaseline ? "baseline-ink" : "two-tier";

const manifiesto = JSON.parse(
  await readFile(path.join(corpus, "manifest.json"), "utf8")
) as unknown;
const casos: CorpusEntry[] = parseManifest(manifiesto);
const report = await runEval({
  cases: casos,
  verifier,
  loadImage: leerBitmap,
  budgets: BUDGETS,
  verifierName,
});

console.log(formatReport(report));
for (const fallo of report.failures) {
  console.log(`  fallo: ${fallo.path} (${fallo.label}) -> ${fallo.verdict ? "aceptada" : "rechazada"}`);
}
process.exit(report.passed ? 0 : 1);
