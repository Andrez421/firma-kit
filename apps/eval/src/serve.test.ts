import { request } from "node:http";
import { connect } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { startGateServer, type ServeOptions } from "./serve.js";

// El contrato HTTP se prueba con un gate falso: cargar SigLIP aquí haría que el
// test dependiera de 201 MB de pesos para comprobar un `fetch`.
const gate = (puntaje: number) => ({ score: async () => puntaje });

let cerrar: (() => Promise<void>) | null = null;
let pendientes: Array<() => void> = [];

afterEach(async () => {
  for (const abortar of pendientes) abortar();
  pendientes = [];
  if (cerrar) await cerrar();
  cerrar = null;
});

async function arrancar(puntaje: number, opciones: ServeOptions = {}) {
  const { servidor, url } = await startGateServer({
    port: 0,
    gate: gate(puntaje),
    ...opciones,
  });
  cerrar = () =>
    new Promise((listo) => {
      servidor.closeAllConnections();
      servidor.close(() => listo());
    });
  return url;
}

const cuerpo = (ancho: number, alto: number) =>
  new Uint8Array(ancho * alto * 4).fill(255);

/** Petición cruda por socket, para lo que `fetch` no deja provocar. */
function crudo(url: string, texto: string): Promise<{ respuesta: string; cerrada: boolean }> {
  const { hostname, port } = new URL(url);
  return new Promise((listo) => {
    let recibido = "";
    let cerrada = false;
    const socket = connect(Number(port), hostname, () => socket.write(texto));
    pendientes.push(() => socket.destroy());
    socket.on("data", (trozo) => (recibido += trozo.toString()));
    socket.on("close", () => {
      cerrada = true;
      listo({ respuesta: recibido, cerrada });
    });
    socket.on("error", () => {
      cerrada = true;
      listo({ respuesta: recibido, cerrada });
    });
  });
}

describe("servicio del gate", () => {
  it("responde si la imagen parece una firma", async () => {
    const url = await arrancar(0.99);
    const res = await fetch(`${url}/verificar?w=2&h=2`, { method: "POST", body: cuerpo(2, 2) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ isSignature: true, tier: 1 });
  });

  it("responde que no cuando el gate no la reconoce", async () => {
    const url = await arrancar(0.2);
    const res = await fetch(`${url}/verificar?w=2&h=2`, { method: "POST", body: cuerpo(2, 2) });
    expect(await res.json()).toMatchObject({ isSignature: false, confidence: 0.2 });
  });

  it("exige ancho y alto", async () => {
    const url = await arrancar(0.9);
    const res = await fetch(`${url}/verificar`, { method: "POST", body: cuerpo(2, 2) });
    expect(res.status).toBe(400);
  });

  it("rechaza un cuerpo que no tiene w*h*4 bytes", async () => {
    const url = await arrancar(0.9);
    const res = await fetch(`${url}/verificar?w=10&h=10`, {
      method: "POST",
      body: cuerpo(2, 2),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("w*h*4") });
  });

  it("expone una sonda de salud para que el cliente sepa si hay gate", async () => {
    const url = await arrancar(0.9);
    const res = await fetch(`${url}/salud`);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("acepta el cuerpo por trozos con el mismo veredicto", async () => {
    const url = await arrancar(0.99);
    // Sin content-length, `fetch` manda chunked: el camino de trozos.
    const flujo = new ReadableStream({
      start(control) {
        control.enqueue(cuerpo(2, 2));
        control.close();
      },
    });
    const res = await fetch(`${url}/verificar?w=2&h=2`, {
      method: "POST",
      body: flujo,
      duplex: "half",
    } as RequestInit);
    expect(await res.json()).toMatchObject({ isSignature: true });
  });

  describe("S1 — token y orígenes", () => {
    it("exige el token cuando está configurado", async () => {
      const url = await arrancar(0.99, { token: "secreto" });
      const sin = await fetch(`${url}/verificar?w=2&h=2`, {
        method: "POST",
        body: cuerpo(2, 2),
      });
      expect(sin.status).toBe(401);

      const con = await fetch(`${url}/verificar?w=2&h=2`, {
        method: "POST",
        body: cuerpo(2, 2),
        headers: { "x-gate-token": "secreto" },
      });
      expect(con.status).toBe(200);
    });

    it("rechaza un token distinto sin dejar de responder", async () => {
      const url = await arrancar(0.99, { token: "secreto" });
      const res = await fetch(`${url}/verificar?w=2&h=2`, {
        method: "POST",
        body: cuerpo(2, 2),
        headers: { "x-gate-token": "otro" },
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "token inválido" });
    });

    it("responde el preflight solo al origen permitido", async () => {
      const url = await arrancar(0.99, { origins: ["http://localhost:5173"] });
      const propio = await fetch(`${url}/verificar`, {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
          "access-control-request-headers": "x-gate-token",
        },
      });
      expect(propio.status).toBe(204);
      expect(propio.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
      expect(propio.headers.get("access-control-allow-headers")).toContain("x-gate-token");

      const ajeno = await fetch(`${url}/verificar`, {
        method: "OPTIONS",
        headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
      });
      expect(ajeno.status).toBe(403);
      expect(ajeno.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("rechaza una petición de un origen no permitido", async () => {
      const url = await arrancar(0.99, { origins: ["http://localhost:5173"] });
      const res = await fetch(`${url}/verificar?w=2&h=2`, {
        method: "POST",
        body: cuerpo(2, 2),
        headers: { origin: "https://evil.example" },
      });
      expect(res.status).toBe(403);
    });

    it("no manda cabecera CORS si no hay orígenes configurados", async () => {
      const url = await arrancar(0.99);
      const res = await fetch(`${url}/salud`, { headers: { origin: "http://localhost:5173" } });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("se niega a arrancar fuera de loopback sin token", async () => {
      await expect(startGateServer({ port: 0, host: "0.0.0.0", gate: gate(0.9) })).rejects.toThrow(
        /GATE_TOKEN/
      );
    });
  });

  describe("S2 — límites de uso", () => {
    it("responde 429 con Retry-After al agotar el cubo", async () => {
      const url = await arrancar(0.99, {
        rateLimit: { capacity: 2, refillPerSecond: 0.01 },
      });
      const pedir = () => fetch(`${url}/verificar?w=2&h=2`, { method: "POST", body: cuerpo(2, 2) });
      expect((await pedir()).status).toBe(200);
      expect((await pedir()).status).toBe(200);
      const tercera = await pedir();
      expect(tercera.status).toBe(429);
      expect(Number(tercera.headers.get("retry-after"))).toBeGreaterThan(0);
    });

    it("responde 503 en vez de encolar cuando el gate está ocupado", async () => {
      // En un objeto: asignar una variable desde dentro de la promesa deja a
      // TypeScript con el tipo estrechado a `null` en el punto de la llamada.
      const enVuelo: { soltar?: () => void } = {};
      const lento = {
        score: () =>
          new Promise<number>((listo) => {
            enVuelo.soltar = () => listo(0.99);
          }),
      };
      const { servidor, url } = await startGateServer({ port: 0, gate: lento, maxInFlight: 1 });
      cerrar = () =>
        new Promise((listo) => {
          enVuelo.soltar?.();
          servidor.closeAllConnections();
          servidor.close(() => listo());
        });

      const primera = fetch(`${url}/verificar?w=2&h=2`, { method: "POST", body: cuerpo(2, 2) });
      // Deja que la primera entre en vuelo antes de la segunda.
      await new Promise((listo) => setTimeout(listo, 50));
      const segunda = await fetch(`${url}/verificar?w=2&h=2`, {
        method: "POST",
        body: cuerpo(2, 2),
      });
      expect(segunda.status).toBe(503);
      expect(segunda.headers.get("retry-after")).toBe("1");
      enVuelo.soltar?.();
      expect((await primera).status).toBe(200);
    });
  });

  describe("S3 — timeouts", () => {
    it("cierra un cuerpo que se estanca en vez de esperar minutos", async () => {
      const url = await arrancar(0.99, { requestTimeoutMs: 300 });
      const { cerrada } = await crudo(
        url,
        "POST /verificar?w=2&h=2 HTTP/1.1\r\nHost: x\r\nContent-Length: 16\r\n\r\n"
      );
      expect(cerrada).toBe(true);
    });
  });

  describe("S4 — cuerpo demasiado grande", () => {
    it("responde 413 con Connection: close", async () => {
      const url = await arrancar(0.99);
      const grande = Buffer.alloc(13 * 1024 * 1024, 200);
      const res = await fetch(`${url}/verificar?w=10&h=10`, {
        method: "POST",
        body: grande,
      }).catch(() => null);
      // El servidor puede cortar antes de que el cliente termine de escribir; lo
      // que importa es que después el servicio siga sano y reutilizable.
      expect(res === null || res.status === 413).toBe(true);
      const salud = await fetch(`${url}/salud`);
      expect(salud.status).toBe(200);
    });

    it("no envenena el pool: la petición siguiente funciona", async () => {
      const url = await arrancar(0.99);
      const agente = new (await import("node:http")).Agent({ keepAlive: true });
      const pedir = (datos: Buffer) =>
        new Promise<number>((listo, fallo) => {
          const req = request(
            `${url}/verificar?w=2&h=2`,
            { method: "POST", agent: agente, headers: { "content-length": datos.length } },
            (res) => {
              res.resume();
              res.on("end", () => listo(res.statusCode ?? 0));
            }
          );
          req.on("error", fallo);
          req.end(datos);
        });

      expect(await pedir(Buffer.alloc(13 * 1024 * 1024, 1))).toBe(413);
      // Antes esto moría con ECONNRESET al reutilizar el socket reseteado.
      expect(await pedir(Buffer.from(cuerpo(2, 2)))).toBe(200);
      agente.destroy();
    });
  });
});
