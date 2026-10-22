// Servicio local del gate: recibe una imagen RGBA y responde si parece una firma.
//
// Existe porque el verificador corre donde vive la imagen (Node con el modelo), y
// el navegador no puede cargar 201 MB de ONNX en cada visita. El componente acepta
// un `Verificador`; este servicio es la implementación de referencia para quien
// prefiera no meter el modelo en el cliente.
//
// Es un servicio de desarrollo, y eso se nota en las decisiones: sin TLS, con un
// token compartido en vez de cuentas, y con límites pensados para una sola persona
// probando desde su red. Lo que no se negocia es lo que costó un incidente real:
// un cuerpo grande no puede envenenar el pool del cliente, un cuerpo lento no puede
// ocupar la conexión cinco minutos, y una página cualquiera no puede usar el gate
// como oráculo.

import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { Bitmap } from "@firma-kit/core";
import { createZeroShotGate, modelsDir, THRESHOLDS, type Gate } from "@firma-kit/verify";

export type ServeOptions = {
  port?: number;
  host?: string;
  /** Inyectable para probar el contrato HTTP sin cargar el modelo. */
  gate?: Gate;
  models?: string;
  /**
   * Token compartido que el cliente manda en `x-gate-token`. Sin token, el
   * servicio solo se abre en loopback: expuesto a la red, se niega a arrancar.
   */
  token?: string;
  /** Orígenes permitidos para CORS. Sin lista no se manda cabecera CORS. */
  origins?: string[];
  /** Peticiones en vuelo a la vez: ONNX es de un solo hilo. */
  maxInFlight?: number;
  /** Cubo de fichas por IP. */
  rateLimit?: { capacity: number; refillPerSecond: number };
  headersTimeoutMs?: number;
  requestTimeoutMs?: number;
  keepAliveTimeoutMs?: number;
};

const MAX_BYTES = 12 * 1024 * 1024;

/** Error de cuerpo demasiado grande: se responde 413 y se cierra la conexión. */
class CuerpoDemasiadoGrande extends Error {}

function json(
  respuesta: ServerResponse,
  codigo: number,
  cuerpo: unknown,
  extra: Record<string, string> = {}
): void {
  const texto = JSON.stringify(cuerpo);
  respuesta.writeHead(codigo, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(texto),
    // Un veredicto no se cachea y no se reinterpreta como otro tipo.
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra,
  });
  respuesta.end(texto);
}

/** Compara sin filtrar por tiempo cuánto coincide el prefijo. */
function mismoToken(recibido: string, esperado: string): boolean {
  const a = createHash("sha256").update(recibido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

/**
 * Cubo de fichas por IP: `capacity` de golpe y `refillPerSecond` de recarga. Un
 * mapa acotado evita que el limitador se convierta él mismo en una fuga.
 */
function crearLimitador(capacity: number, refillPerSecond: number) {
  const cubos = new Map<string, { fichas: number; ultimo: number }>();
  return function consumir(ip: string): number | null {
    const ahora = Date.now();
    let cubo = cubos.get(ip);
    if (!cubo) {
      if (cubos.size > 10_000) cubos.clear();
      cubo = { fichas: capacity, ultimo: ahora };
      cubos.set(ip, cubo);
    }
    const transcurrido = (ahora - cubo.ultimo) / 1000;
    cubo.fichas = Math.min(capacity, cubo.fichas + transcurrido * refillPerSecond);
    cubo.ultimo = ahora;
    if (cubo.fichas < 1) {
      // Cuánto falta para la siguiente ficha, en segundos enteros.
      return Math.max(1, Math.ceil((1 - cubo.fichas) / refillPerSecond));
    }
    cubo.fichas -= 1;
    return null;
  };
}

/**
 * Lee el cuerpo reservando una sola vez cuando `content-length` es creíble. El
 * camino de trozos solo aparece si el cliente manda *chunked* o miente sobre el
 * tamaño: nunca se paga `Buffer.concat` más una copia en el caso normal.
 */
async function leerCuerpo(peticion: IncomingMessage): Promise<Uint8ClampedArray> {
  const declarado = Number(peticion.headers["content-length"]);
  const reservado =
    Number.isInteger(declarado) && declarado > 0 && declarado <= MAX_BYTES ? declarado : 0;
  let destino: Uint8ClampedArray | null = reservado ? new Uint8ClampedArray(reservado) : null;
  let trozos: Buffer[] = [];
  let total = 0;

  for await (const trozo of peticion) {
    const datos = trozo as Buffer;
    total += datos.length;
    if (total > MAX_BYTES) {
      // Se descarta el resto sin acumularlo: el cliente ya no va a recibir 200.
      peticion.resume();
      throw new CuerpoDemasiadoGrande("imagen demasiado grande");
    }
    if (destino && total <= destino.length) {
      destino.set(datos, total - datos.length);
    } else {
      // El cliente mintió sobre el tamaño: se sigue con trozos.
      if (destino) trozos = [Buffer.from(destino)];
      destino = null;
      trozos.push(datos);
    }
  }

  if (destino) return destino.length === total ? destino : destino.subarray(0, total);
  return new Uint8ClampedArray(Buffer.concat(trozos, total));
}

/**
 * Arranca el servicio. `POST /verificar?w=<ancho>&h=<alto>` con el RGBA crudo en
 * el cuerpo responde `{ isSignature, confidence, tier }`.
 */
export async function startGateServer(opciones: ServeOptions = {}) {
  // 8790 y no 8787: ese puerto ya lo usa otro servicio local en esta máquina.
  const {
    port = 8790,
    host = "127.0.0.1",
    token,
    origins,
    maxInFlight = 1,
    rateLimit = { capacity: 20, refillPerSecond: 0.5 },
    headersTimeoutMs = 10_000,
    requestTimeoutMs = 30_000,
    keepAliveTimeoutMs = 5_000,
  } = opciones;

  const enLoopback = host === "127.0.0.1" || host === "::1" || host === "localhost";
  if (!enLoopback && !token) {
    throw new Error(
      "GATE_HOST fuera de loopback exige GATE_TOKEN: un gate abierto a la red y sin token es un oráculo para cualquier página"
    );
  }

  const gate = opciones.gate ?? (await createZeroShotGate({ modelsDir: opciones.models ?? modelsDir() }));
  const consumir = crearLimitador(rateLimit.capacity, rateLimit.refillPerSecond);
  let enVuelo = 0;

  const servidor = createServer(async (peticion, respuesta) => {
    const url = new URL(peticion.url ?? "/", `http://${peticion.headers.host ?? "local"}`);
    const origen = peticion.headers.origin;
    const permitido = origen !== undefined && origins?.includes(origen) === true;
    const cors: Record<string, string> = permitido
      ? {
          "access-control-allow-origin": origen,
          "access-control-allow-methods": "POST, GET, OPTIONS",
          "access-control-allow-headers": "x-gate-token, content-type",
          "access-control-max-age": "600",
          vary: "origin",
        }
      : {};

    // Preflight: con token la petición deja de ser "simple" y el navegador
    // pregunta primero. Sin esta rama el arnés no podría verificar nada.
    if (peticion.method === "OPTIONS") {
      if (!permitido) {
        json(respuesta, 403, { error: "origen no permitido" });
        return;
      }
      respuesta.writeHead(204, cors);
      respuesta.end();
      return;
    }

    // Un origen declarado que no está en la lista se rechaza aquí: es lo que
    // impide que cualquier página use el servicio como oráculo.
    if (origen !== undefined && origins !== undefined && !permitido) {
      json(respuesta, 403, { error: "origen no permitido" });
      return;
    }

    // La sonda queda fuera del token: el arnés necesita saber si hay gate antes
    // de tener con qué verificar, y no revela nada del contenido.
    if (peticion.method === "GET" && url.pathname === "/salud") {
      json(respuesta, 200, { ok: true, model: "siglip-base-patch16-224" }, cors);
      return;
    }

    if (peticion.method !== "POST" || url.pathname !== "/verificar") {
      json(respuesta, 404, { error: "ruta no encontrada" }, cors);
      return;
    }

    if (token) {
      const recibido = peticion.headers["x-gate-token"];
      if (typeof recibido !== "string" || !mismoToken(recibido, token)) {
        json(respuesta, 401, { error: "token inválido" }, cors);
        return;
      }
    }

    const ip = peticion.socket.remoteAddress ?? "desconocida";
    const espera = consumir(ip);
    if (espera !== null) {
      json(
        respuesta,
        429,
        { error: "demasiadas peticiones" },
        { ...cors, "retry-after": String(espera) }
      );
      return;
    }

    // Sin cola: el modelo atiende de una en una, así que una segunda petición
    // recibe 503 y decide el cliente, en vez de esperar segundos sin saberlo.
    if (enVuelo >= maxInFlight) {
      json(respuesta, 503, { error: "gate ocupado" }, { ...cors, "retry-after": "1" });
      return;
    }

    const ancho = Number(url.searchParams.get("w"));
    const alto = Number(url.searchParams.get("h"));
    if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto <= 0) {
      json(respuesta, 400, { error: "faltan w y h" }, cors);
      return;
    }

    enVuelo += 1;
    try {
      const datos = await leerCuerpo(peticion);
      if (datos.length !== ancho * alto * 4) {
        json(respuesta, 400, { error: "el cuerpo no tiene w*h*4 bytes" }, cors);
        return;
      }
      const imagen: Bitmap = { data: datos, width: ancho, height: alto };
      const puntaje = await gate.score(imagen);
      // La puntuación del gate es relativa (1 = la firma gana la comparación).
      json(
        respuesta,
        200,
        {
          isSignature: puntaje >= THRESHOLDS.gateAccept,
          confidence: puntaje,
          tier: 1,
        },
        cors
      );
    } catch (error) {
      if (error instanceof CuerpoDemasiadoGrande) {
        // `connection: close` para que el cliente no reutilice un socket que el
        // servidor va a cerrar: eso era el ECONNRESET que tumbaba la petición
        // siguiente.
        json(respuesta, 413, { error: error.message }, { ...cors, connection: "close" });
        respuesta.on("finish", () => peticion.destroy());
        return;
      }
      json(
        respuesta,
        500,
        { error: error instanceof Error ? error.message : "error" },
        cors
      );
    } finally {
      enVuelo -= 1;
    }
  });

  // Node exige que `headersTimeout` no pase de `requestTimeout`: si se invierte,
  // el plazo corto deja de vigilarse. Se acota en vez de confiar en el llamador.
  servidor.headersTimeout = Math.min(headersTimeoutMs, requestTimeoutMs);
  servidor.requestTimeout = requestTimeoutMs;
  servidor.keepAliveTimeout = keepAliveTimeoutMs;
  // Node no vigila esos plazos de forma continua: los revisa cada
  // `connectionsCheckingInterval`, que por defecto son 30 s. Sin esto, un cuerpo
  // lento con `requestTimeout` de 30 s se cerraría a los 60, y en los tests un
  // plazo de 300 ms no se notaría nunca.
  // `connectionsCheckingInterval` existe en el servidor de Node pero no en los
  // tipos: se asigna con un molde explícito.
  (servidor as unknown as { connectionsCheckingInterval: number }).connectionsCheckingInterval =
    Math.max(50, Math.min(1_000, Math.floor(Math.min(headersTimeoutMs, requestTimeoutMs) / 2)));

  // Node avisa por aquí cuando un plazo se cumple o el cliente manda basura.
  // Sin manejador propio, el socket puede quedarse abierto esperando un cuerpo
  // que ya no va a llegar.
  servidor.on("clientError", (error: NodeJS.ErrnoException, socket) => {
    if (!socket.destroyed && socket.writable) {
      const plazo = error.code === "ERR_HTTP_REQUEST_TIMEOUT";
      socket.end(
        `HTTP/1.1 ${plazo ? "408 Request Timeout" : "400 Bad Request"}\r\nconnection: close\r\ncontent-length: 0\r\n\r\n`
      );
    }
    socket.destroy();
  });

  await new Promise<void>((listo) => servidor.listen(port, host, listo));
  const direccion = servidor.address();
  const puerto = typeof direccion === "object" && direccion ? direccion.port : port;
  return { servidor, url: `http://${host}:${puerto}` };
}

// Ejecutado directamente (`pnpm --filter @firma-kit/eval serve`).
if (process.argv[1]?.endsWith("serve.js")) {
  const host = process.env["GATE_HOST"] ?? "127.0.0.1";
  const token = process.env["GATE_TOKEN"] || undefined;
  const origins = (process.env["GATE_ORIGINS"] ?? "")
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);
  const { url } = await startGateServer({
    port: Number(process.env["GATE_PORT"] ?? 8790),
    host,
    ...(token ? { token } : {}),
    ...(origins.length > 0 ? { origins } : {}),
  });
  console.log(`gate escuchando en ${url} (modelos en ${modelsDir()})`);
  if (token) console.log("token exigido en la cabecera x-gate-token");
  if (host === "0.0.0.0") {
    console.log(
      `expuesto en todas las interfaces; orígenes permitidos: ${origins.length > 0 ? origins.join(", ") : "ninguno (sin cabecera CORS)"}`
    );
  }
}
