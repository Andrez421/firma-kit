// Descarga y comprobación de modelos.
//
// Reglas de la casa: descarga explícita (nunca en la primera petición de una
// persona), hash comprobado antes de dar el archivo por bueno, escritura
// atómica y ningún archivo a medias sobreviviendo a un fallo.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ModelFile, ModelSpec } from "./models.js";

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export type PullOptions = {
  dir: string;
  specs: ModelSpec[];
  fetchImpl: FetchLike;
  /** Permite bajar archivos cuyo SHA-256 aún no está fijado. */
  allowUnverified?: boolean;
  onProgress?: (event: { name: string; state: "downloaded" | "skipped" }) => void;
};

export type PullReport = {
  downloaded: string[];
  skipped: string[];
  unverified: string[];
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Baja los archivos que faltan y valida los que ya están.
 *
 * Un archivo existente con hash distinto NO se sobrescribe en silencio: se trata
 * como corrupción y se informa, porque un modelo alterado es un problema de
 * confianza, no un detalle de caché.
 */
export async function pullModels(options: PullOptions): Promise<PullReport> {
  const { dir, specs, fetchImpl, allowUnverified = false, onProgress } = options;
  await mkdir(dir, { recursive: true });

  const report: PullReport = { downloaded: [], skipped: [], unverified: [] };

  for (const spec of specs) {
    for (const file of spec.files) {
      const target = path.join(dir, file.name);

      if (await exists(target)) {
        await checkExisting(target, file, report);
        report.skipped.push(file.name);
        onProgress?.({ name: file.name, state: "skipped" });
        continue;
      }

      if (!file.sha256 && !allowUnverified) {
        throw new Error(
          `${file.name} no tiene SHA-256 fijado. Fíjalo en models.ts o pasa allowUnverified a propósito.`
        );
      }

      const response = await fetchImpl(file.url);
      if (!response.ok) {
        throw new Error(`No se pudo bajar ${file.name}: HTTP ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());

      if (file.sha256) {
        const actual = sha256(bytes);
        if (actual !== file.sha256) {
          throw new Error(
            `${file.name} no coincide con el SHA-256 esperado (got ${actual}). No se guarda.`
          );
        }
      } else {
        report.unverified.push(file.name);
      }

      const partial = `${target}.part`;
      await writeFile(partial, bytes);
      // El rename es atómico: nunca queda un archivo con nombre definitivo y
      // contenido incompleto.
      await rename(partial, target);
      report.downloaded.push(file.name);
      onProgress?.({ name: file.name, state: "downloaded" });
    }
  }

  return report;
}

async function checkExisting(
  target: string,
  file: ModelFile,
  report: PullReport
): Promise<void> {
  if (!file.sha256) {
    report.unverified.push(file.name);
    return;
  }
  const bytes = new Uint8Array(await readFile(target));
  const actual = sha256(bytes);
  if (actual !== file.sha256) {
    throw new Error(
      `${file.name} está en disco pero con otro SHA-256 (${actual}). Bórralo y vuelve a bajarlo.`
    );
  }
}

export type DoctorReport = {
  ok: boolean;
  files: Array<{
    name: string;
    state: "missing" | "ok" | "hash-mismatch" | "no-hash";
    bytes?: number;
  }>;
};

/** Diagnóstico sin red: dice qué falta y qué no coincide. */
export async function checkModels(options: {
  dir: string;
  specs: ModelSpec[];
}): Promise<DoctorReport> {
  const { dir, specs } = options;
  const report: DoctorReport = { ok: true, files: [] };

  for (const spec of specs) {
    for (const file of spec.files) {
      const target = path.join(dir, file.name);
      if (!(await exists(target))) {
        report.files.push({ name: file.name, state: "missing" });
        report.ok = false;
        continue;
      }
      const bytes = new Uint8Array(await readFile(target));
      if (!file.sha256) {
        report.files.push({ name: file.name, state: "no-hash", bytes: bytes.length });
        continue;
      }
      const actual = sha256(bytes);
      if (actual !== file.sha256) {
        report.files.push({ name: file.name, state: "hash-mismatch", bytes: bytes.length });
        report.ok = false;
        continue;
      }
      report.files.push({ name: file.name, state: "ok", bytes: bytes.length });
    }
  }

  return report;
}

/** Borra un archivo corrupto; lo usa el flujo de recuperación del operador. */
export async function removeFile(dir: string, name: string): Promise<void> {
  await rm(path.join(dir, name), { force: true });
}
