import { afterEach, describe, expect, it } from "vitest";

import { startGateServer } from "./serve.js";

// El contrato HTTP se prueba con un gate falso: cargar SigLIP aquí haría que el
// test dependiera de 201 MB de pesos para comprobar un `fetch`.
const gate = (puntaje: number) => ({ score: async () => puntaje });

let cerrar: (() => Promise<void>) | null = null;

afterEach(async () => {
  if (cerrar) await cerrar();
  cerrar = null;
});

async function arrancar(puntaje: number) {
  const { servidor, url } = await startGateServer({ port: 0, gate: gate(puntaje) });
  cerrar = () => new Promise((listo) => servidor.close(() => listo()));
  return url;
}

const cuerpo = (ancho: number, alto: number) =>
  new Uint8Array(ancho * alto * 4).fill(255);

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
});
