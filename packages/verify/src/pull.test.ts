import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelSpec } from "./models.js";
import { checkModels, pullModels, type FetchLike } from "./pull.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "firma-kit-models-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const PESOS = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const HASH = createHash("sha256").update(PESOS).digest("hex");

function spec(sha256: string | null = HASH): ModelSpec[] {
  return [
    {
      id: "prueba",
      tier: 1,
      licence: "test",
      files: [
        {
          name: "pesos.bin",
          url: "https://example.test/pesos.bin",
          bytes: PESOS.length,
          sha256,
        },
      ],
    },
  ];
}

function fetchQueDevuelve(datos: Uint8Array, ok = true): FetchLike {
  return async () => ({
    ok,
    status: ok ? 200 : 404,
    arrayBuffer: async () => new Uint8Array(datos).buffer,
  });
}

describe("pullModels", () => {
  it("baja, verifica el hash y deja el archivo con su nombre definitivo", async () => {
    const fetchImpl = vi.fn(fetchQueDevuelve(PESOS));
    const report = await pullModels({ dir, specs: spec(), fetchImpl });

    expect(report.downloaded).toEqual(["pesos.bin"]);
    expect(new Uint8Array(await readFile(path.join(dir, "pesos.bin")))).toEqual(PESOS);
    // Nada de `.part` sobreviviendo.
    expect(await readdir(dir)).toEqual(["pesos.bin"]);
  });

  it("no sobrescribe ni vuelve a bajar lo que ya está y coincide", async () => {
    await writeFile(path.join(dir, "pesos.bin"), PESOS);
    const fetchImpl = vi.fn(fetchQueDevuelve(PESOS));
    const report = await pullModels({ dir, specs: spec(), fetchImpl });

    expect(report.skipped).toEqual(["pesos.bin"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("un hash que no coincide no se guarda y borra el intento", async () => {
    const otros = new Uint8Array([9, 9, 9]);
    await expect(
      pullModels({ dir, specs: spec(), fetchImpl: fetchQueDevuelve(otros) })
    ).rejects.toThrow(/SHA-256/);
    // Ni archivo definitivo ni parcial.
    expect(await readdir(dir)).toEqual([]);
  });

  it("se niega a bajar pesos sin hash y lo dice", async () => {
    await expect(
      pullModels({ dir, specs: spec(null), fetchImpl: fetchQueDevuelve(PESOS) })
    ).rejects.toThrow(/sin SHA-256 fijado|no tiene SHA-256/);
    expect(await readdir(dir)).toEqual([]);
  });

  it("con allowUnverified baja igual y lo deja anotado", async () => {
    const report = await pullModels({
      dir,
      specs: spec(null),
      fetchImpl: fetchQueDevuelve(PESOS),
      allowUnverified: true,
    });
    expect(report.unverified).toEqual(["pesos.bin"]);
  });

  it("un archivo en disco con otro hash se trata como corrupción", async () => {
    await writeFile(path.join(dir, "pesos.bin"), new Uint8Array([7]));
    await expect(
      pullModels({ dir, specs: spec(), fetchImpl: fetchQueDevuelve(PESOS) })
    ).rejects.toThrow(/otro SHA-256/);
  });

  it("un HTTP que no es 2xx se reporta con su código", async () => {
    await expect(
      pullModels({ dir, specs: spec(), fetchImpl: fetchQueDevuelve(PESOS, false) })
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe("checkModels", () => {
  it("distingue falta, ok, hash distinto y sin hash", async () => {
    const specs = spec();
    const vacio = await checkModels({ dir, specs });
    expect(vacio.ok).toBe(false);
    expect(vacio.files[0]!.state).toBe("missing");

    await writeFile(path.join(dir, "pesos.bin"), PESOS);
    const correcto = await checkModels({ dir, specs });
    expect(correcto.ok).toBe(true);
    expect(correcto.files[0]!.state).toBe("ok");

    await writeFile(path.join(dir, "pesos.bin"), new Uint8Array([0]));
    const corrupto = await checkModels({ dir, specs });
    expect(corrupto.ok).toBe(false);
    expect(corrupto.files[0]!.state).toBe("hash-mismatch");

    // Sin hash fijado no se puede afirmar nada sobre el contenido: se informa
    // como "no-hash" y no se cuenta como fallo, pero tampoco como verificado.
    const sinHash = await checkModels({ dir, specs: spec(null) });
    expect(sinHash.files[0]!.state).toBe("no-hash");
    expect(sinHash.ok).toBe(true);
  });
});
