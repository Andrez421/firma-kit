// Servicio local del gate: recibe una imagen RGBA y responde si parece una firma.
//
// Existe porque el verificador corre donde vive la imagen (Node con el modelo), y
// el navegador no puede cargar 201 MB de ONNX en cada visita. El componente acepta
// un `Verificador`; este servicio es la implementación de referencia para quien
// prefiera no meter el modelo en el cliente.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { Bitmap } from "@firma-kit/core";
import { createZeroShotGate, modelsDir, THRESHOLDS, type Gate } from "@firma-kit/verify";

export type ServeOptions = {
  port?: number;
  host?: string;
  /** Inyectable para probar el contrato HTTP sin cargar el modelo. */
  gate?: Gate;
  models?: string;
};

const MAX_BYTES = 12 * 1024 * 1024;

function json(respuesta: ServerResponse, codigo: number, cuerpo: unknown): void {
  const texto = JSON.stringify(cuerpo);
  respuesta.writeHead(codigo, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(texto),
    // El arnés corre en otra origen (otra IP de la tailnet, o el móvil). Es un
    // servicio de desarrollo atado a localhost: el permiso no sale de la máquina.
    "access-control-allow-origin": "*",
  });
  respuesta.end(texto);
}

async function leerCuerpo(peticion: IncomingMessage): Promise<Uint8ClampedArray> {
  const trozos: Buffer[] = [];
  let total = 0;
  for await (const trozo of peticion) {
    total += (trozo as Buffer).length;
    if (total > MAX_BYTES) throw new Error("imagen demasiado grande");
    trozos.push(trozo as Buffer);
  }
  return new Uint8ClampedArray(Buffer.concat(trozos));
}

/**
 * Arranca el servicio. `POST /verificar?w=<ancho>&h=<alto>` con el RGBA crudo en
 * el cuerpo responde `{ isSignature, confidence, tier }`.
 */
export async function startGateServer(opciones: ServeOptions = {}) {
  // 8790 y no 8787: ese puerto ya lo usa otro servicio local en esta máquina.
  const { port = 8790, host = "127.0.0.1" } = opciones;
  const gate = opciones.gate ?? (await createZeroShotGate({ modelsDir: opciones.models ?? modelsDir() }));

  const servidor = createServer(async (peticion, respuesta) => {
    const url = new URL(peticion.url ?? "/", `http://${peticion.headers.host ?? "local"}`);

    if (peticion.method === "GET" && url.pathname === "/salud") {
      json(respuesta, 200, { ok: true, model: "siglip-base-patch16-224" });
      return;
    }

    if (peticion.method !== "POST" || url.pathname !== "/verificar") {
      json(respuesta, 404, { error: "ruta no encontrada" });
      return;
    }

    const ancho = Number(url.searchParams.get("w"));
    const alto = Number(url.searchParams.get("h"));
    if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto <= 0) {
      json(respuesta, 400, { error: "faltan w y h" });
      return;
    }

    try {
      const datos = await leerCuerpo(peticion);
      if (datos.length < ancho * alto * 4) {
        json(respuesta, 400, { error: "el cuerpo no tiene w*h*4 bytes" });
        return;
      }
      const imagen: Bitmap = { data: datos, width: ancho, height: alto };
      const puntaje = await gate.score(imagen);
      // La puntuación del gate es relativa (1 = la firma gana la comparación).
      json(respuesta, 200, {
        isSignature: puntaje >= THRESHOLDS.gateAccept,
        confidence: puntaje,
        tier: 1,
      });
    } catch (error) {
      json(respuesta, 413, { error: error instanceof Error ? error.message : "error" });
    }
  });

  await new Promise<void>((listo) => servidor.listen(port, host, listo));
  const direccion = servidor.address();
  const puerto = typeof direccion === "object" && direccion ? direccion.port : port;
  return { servidor, url: `http://${host}:${puerto}` };
}

// Ejecutado directamente (`pnpm --filter @firma-kit/eval serve`).
if (process.argv[1]?.endsWith("serve.js")) {
  const { url } = await startGateServer({
    port: Number(process.env["GATE_PORT"] ?? 8790),
    host: process.env["GATE_HOST"] ?? "127.0.0.1",
  });
  console.log(`gate escuchando en ${url} (modelos en ${modelsDir()})`);
  if (process.env["GATE_HOST"] === "0.0.0.0") {
    console.log(
      "expuesto en todas las interfaces: es un servicio de desarrollo sin autenticación, úsalo solo en una red de confianza"
    );
  }
}
