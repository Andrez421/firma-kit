#!/usr/bin/env node
// CLI de gestión de modelos: `pull` antes de servir, `doctor` cuando algo no
// cuadra. Nada de descargas implícitas dentro de una petición.

import { MODELS, modelsDir } from "./models.js";
import { checkModels, pullModels } from "./pull.js";

async function main(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;
  const dir = process.env["FIRMA_KIT_MODULES_DIR"] ?? modelsDir();

  if (command === "models" && subcommand === "pull") {
    const allowUnverified = rest.includes("--allow-unverified");
    const report = await pullModels({
      dir,
      specs: MODELS,
      fetchImpl: fetch,
      ...(allowUnverified ? { allowUnverified } : {}),
      onProgress: (event) =>
        console.log(`${event.state === "downloaded" ? "↓" : "="} ${event.name}`),
    });
    console.log(
      `downloaded ${report.downloaded.length}, already present ${report.skipped.length}` +
        (report.unverified.length
          ? `, no hash (unverifiable): ${report.unverified.join(", ")}`
          : "")
    );
    return report.unverified.length && !allowUnverified ? 1 : 0;
  }

  if (command === "doctor" || (command === "models" && subcommand === "status")) {
    const report = await checkModels({ dir, specs: MODELS });
    for (const file of report.files) {
      const detail = file.bytes ? ` (${file.bytes} bytes)` : "";
      console.log(`${file.state.padEnd(14)} ${file.name}${detail}`);
    }
    console.log(report.ok ? "models ready" : "missing models or hash mismatches");
    return report.ok ? 0 : 1;
  }

  console.log(`usage:
  firma-kit-verify models pull [--allow-unverified]   download the models
  firma-kit-verify models status                      cache state
  firma-kit-verify doctor                             offline diagnostic

directory: ${dir} (FIRMA_KIT_MODULES_DIR)`);
  return command ? 2 : 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
