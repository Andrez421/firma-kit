import { createHash } from "node:crypto";

import { detectFormat } from "@firma-kit/core";

import { prisma } from "../../../lib/prisma";

// El módulo devuelve PNG opacos de 900 px como mucho; 2 MB deja aire de sobra y
// evita que un cliente llene la base con cualquier cosa.
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Ancho y alto se leen del IHDR del propio PNG (bytes 16..24) en vez de creerle al
 * cliente: es el mismo archivo que se va a guardar, así que no hay nada que falsear.
 */
function medidasDelPng(png: Uint8Array): { width: number; height: number } | null {
  if (png.byteLength < 24) return null;
  const vista = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = vista.getUint32(16);
  const height = vista.getUint32(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

export async function POST(request: Request) {
  const cuerpo = new Uint8Array(await request.arrayBuffer());

  if (cuerpo.byteLength === 0) {
    return Response.json({ error: "empty body" }, { status: 400 });
  }
  if (cuerpo.byteLength > MAX_BYTES) {
    return Response.json({ error: "signature too large" }, { status: 413 });
  }
  // El formato se decide por los bytes mágicos, no por el content-type que declare
  // el cliente: un `image/png` con un JPEG dentro no pasa.
  if (detectFormat(cuerpo.subarray(0, 8)) !== "png") {
    return Response.json({ error: "expected a PNG" }, { status: 415 });
  }
  const medidas = medidasDelPng(cuerpo);
  if (!medidas) {
    return Response.json({ error: "malformed PNG" }, { status: 400 });
  }

  const hash = createHash("sha256").update(cuerpo).digest("hex");
  const modo = new URL(request.url).searchParams.get("mode") ?? "unknown";
  const sujetoId = new URL(request.url).searchParams.get("subject") ?? null;

  // Guardar dos veces la misma firma no crea dos filas: el hash es único.
  const firma = await prisma.firma.upsert({
    where: { hash },
    update: {},
    create: { hash, png: Buffer.from(cuerpo), ...medidas, mode: modo, sujetoId },
    select: { id: true, hash: true, width: true, height: true, createdAt: true },
  });

  return Response.json(firma, { status: 201 });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const firma = await prisma.firma.findUnique({ where: { id } });
  if (!firma) return Response.json({ error: "not found" }, { status: 404 });

  // Se devuelve el PNG con su tipo y sin caché: una firma no se reutiliza por URL.
  return new Response(new Uint8Array(firma.png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
