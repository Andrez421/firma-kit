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
import { createTwoTierVerifier, createZeroShotGate, modelsDir } from "@firma-kit/verify";

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
 * Verificador con el gate real. Carga MobileCLIP desde el volumen de modelos
 * (`FIRMA_KIT_MODULES_DIR`); si no están, el error lo dice en vez de descargar
 * 55 MB dentro de una petición.
 */
async function verificadorDesdeModelos(): Promise<{ verifier: Verifier; name: string }> {
  const gate = await createZeroShotGate({ modelsDir: modelsDir() });
  return { verifier: createTwoTierVerifier({ gate }), name: "siglip-zero-shot" };
}

// `--baseline` mide el pipeline de tinta, que no necesita modelos. Sin el flag
// se intenta el gate de dos niveles, que hoy lanza porque faltan los pesos.
const usarBaseline = process.argv.includes("--baseline");
const usarGate = process.argv.includes("--gate");
if (!usarBaseline && !usarGate) {
  console.error("Elige verificador: --baseline (pipeline de tinta) o --gate (MobileCLIP)");
  process.exit(2);
}
const elegido = usarBaseline
  ? { verifier: createInkPipelineVerifier(), name: "baseline-ink" }
  : await verificadorDesdeModelos();
const verifier = elegido.verifier;
const verifierName = elegido.name;

const manifiesto = JSON.parse(
  await readFile(path.join(corpus, "manifest.json"), "utf8")
) as unknown;
const todos: CorpusEntry[] = parseManifest(manifiesto);
// `--licensed-only` mide solo con material de licencia conocida: es la única
// parte que puede citarse como evidencia.
const soloLicencias = process.argv.includes("--licensed-only");
const casos = soloLicencias
  ? todos.filter((caso) => caso.source !== "web-unverified")
  : todos;
if (soloLicencias) {
  console.log(`modo licencias: ${casos.length} de ${todos.length} imágenes tienen licencia conocida`);
}
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
