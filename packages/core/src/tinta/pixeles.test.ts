// El pipeline de tinta es la pieza que decide qué se imprime en el PDF: papel
// transparente, trazo negro, y nada más. Estos tests lo fijan con imágenes
// sintéticas (sin canvas ni archivos) porque la regresión que corrige fue
// justamente un umbral que no tenía ninguna prueba: un papel gris salía como
// losa oscura y una foto sin trazo se guardaba igual.
import { describe, expect, it } from "vitest";
import {
  INK_MESSAGE,
  extractInk,
  extractSignature,
  flattenInk,
  stretchLevels,
  type InkBox,
  type InkResult,
} from "./pixeles";

const W = 400;
const H = 240;
const TINTA = 20;

// Lienzo de gris opaco: paint devuelve la luminancia de cada píxel.
function lienzo(paint: (x: number, y: number) => number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = paint(x, y);
      const i = (y * W + x) * 4;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  return px;
}

// Trazo sintético: una curva con la firma dentro del marco.
const CURVA: Array<[number, number]> = [];
for (let i = 0; i < 120; i++) {
  const t = i / 119;
  const x = Math.round(90 + t * 220);
  const y = Math.round(130 - Math.sin(t * Math.PI * 1.6) * 45);
  CURVA.push([x, y]);
}

function dibujarTrazo(px: Uint8ClampedArray, valor = TINTA, grosor = 3) {
  const r = grosor;
  for (const [cx, cy] of CURVA) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        px[i] = valor;
        px[i + 1] = valor;
        px[i + 2] = valor;
        px[i + 3] = 255;
      }
    }
  }
  return px;
}

function firma(papel: number | ((x: number, y: number) => number)) {
  const base = typeof papel === "number" ? () => papel : papel;
  return dibujarTrazo(lienzo(base));
}

function ok(res: InkResult): Extract<InkResult, { ok: true }> {
  if (!res.ok) throw new Error(`se esperaba tinta, llegó ${res.reason}`);
  return res;
}

function motivo(res: InkResult) {
  if (res.ok) throw new Error("se esperaba un rechazo, llegó tinta");
  return res.reason;
}

// Proporción de píxeles que no son blanco puro en la imagen aplanada.
function porcionGris(res: Extract<InkResult, { ok: true }>) {
  const plano = flattenInk(res.alpha, W, H, res.box);
  let grises = 0;
  for (let i = 0; i < plano.rgba.length; i += 4) {
    if (plano.rgba[i] < 240) grises++;
  }
  return grises / (plano.rgba.length / 4);
}

function pixel(res: Extract<InkResult, { ok: true }>, x: number, y: number) {
  return res.alpha[y * W + x];
}

describe("extractInk — el fondo nunca llega al PDF", () => {
  it("papel blanco: el fondo queda en 0 y solo el trazo es tinta", () => {
    const res = ok(extractInk(firma(255), W, H));
    expect(pixel(res, 0, 0)).toBe(0);
    expect(pixel(res, W - 1, H - 1)).toBe(0);
    const [cx, cy] = CURVA[60];
    expect(pixel(res, cx, cy)).toBeGreaterThan(200);
  });

  it("papel gris (lum 150): el mismo resultado que sobre blanco", () => {
    // Regresión: el umbral anterior convertía este papel en alfa 187.
    const res = ok(extractInk(firma(150), W, H));
    expect(pixel(res, 0, 0)).toBe(0);
    expect(pixel(res, W - 1, 0)).toBe(0);
    const plano = flattenInk(res.alpha, W, H, res.box);
    // La esquina superior izquierda de la imagen guardada es blanca.
    expect(plano.rgba[0]).toBe(255);
    expect(porcionGris(res)).toBeLessThan(0.25);
  });

  it("papel oscuro (lum 90) fotografiado con poca luz sigue siendo fondo", () => {
    const res = ok(extractInk(firma(90), W, H));
    expect(pixel(res, 10, 10)).toBe(0);
    expect(porcionGris(res)).toBeLessThan(0.25);
  });

  it("sombra degradada: sin velo de un lado de la hoja", () => {
    // Papel de 140 a 235 en degradado: el error clásico del umbral global.
    const res = ok(extractInk(firma((x) => 140 + (x / W) * 95), W, H));
    expect(pixel(res, 2, 2)).toBe(0);
    expect(pixel(res, W - 3, 2)).toBe(0);
    expect(porcionGris(res)).toBeLessThan(0.25);
  });

  it("viñeta de la cámara (bordes más oscuros): sin velo en las esquinas", () => {
    const res = ok(
      extractInk(
        firma((x, y) => {
          const dx = (x - W / 2) / (W / 2);
          const dy = (y - H / 2) / (H / 2);
          return Math.max(150, 245 - 70 * (dx * dx + dy * dy));
        }),
        W,
        H
      )
    );
    expect(pixel(res, 1, 1)).toBe(0);
    expect(pixel(res, W - 2, H - 2)).toBe(0);
    expect(porcionGris(res)).toBeLessThan(0.25);
  });

  it("marco oscuro alrededor de la foto: se descarta y se recorta al trazo", () => {
    const res = ok(
      extractInk(
        firma((x, y) =>
          x < 20 || y < 20 || x > W - 21 || y > H - 21 ? 25 : 235
        ),
        W,
        H
      )
    );
    const xs = CURVA.map(([x]) => x);
    expect(res.box.x).toBeLessThanOrEqual(Math.min(...xs));
    expect(res.box.x + res.box.w).toBeGreaterThanOrEqual(Math.max(...xs));
    // El marco de 20px queda FUERA del recorte (con margen): si el borde no
    // se detectara como tinta, la caja empezaría en 0 y el marco se imprimiría.
    expect(res.box.x).toBeGreaterThan(20);
    expect(res.box.y).toBeGreaterThan(20);
    const plano = flattenInk(res.alpha, W, H, res.box);
    expect(plano.rgba[0]).toBe(255);
    expect(porcionGris(res)).toBeLessThan(0.25);
  });

  it("recorta al trazo con margen y descarta el resto de la foto", () => {
    const res = ok(extractInk(firma(230), W, H));
    const xs = CURVA.map(([x]) => x);
    const ys = CURVA.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    expect(res.box.x).toBeLessThanOrEqual(minX);
    expect(res.box.x + res.box.w).toBeGreaterThanOrEqual(maxX);
    expect(res.box.y).toBeLessThanOrEqual(minY);
    expect(res.box.y + res.box.h).toBeGreaterThanOrEqual(maxY);
    // El marco completo (400x240) no se devuelve como recorte.
    expect(res.box.w).toBeLessThan(W);
  });

  it("compone el alfa de entrada sobre blanco en vez de leerlo como tinta", () => {
    // PNG con transparencia: el papel no existe (alfa 0) y no debe ser tinta.
    const px = new Uint8ClampedArray(W * H * 4);
    dibujarTrazo(px);
    for (let i = 3; i < px.length; i += 4) {
      // los píxeles sin trazo quedan transparentes (0,0,0,0)
      if (px[i] === 255 && px[i - 3] === TINTA) continue;
      px[i - 3] = 0;
      px[i - 2] = 0;
      px[i - 1] = 0;
      px[i] = 0;
    }
    const res = ok(extractInk(px, W, H));
    expect(pixel(res, 0, 0)).toBe(0);
    expect(flattenInk(res.alpha, W, H, res.box).rgba[0]).toBe(255);
  });
});

describe("extractInk — rechazos accionables", () => {
  it("imagen en blanco: sin tinta", () => {
    expect(motivo(extractInk(lienzo(() => 255), W, H))).toBe("sin_tinta");
  });

  it("papel gris uniforme (sin trazo): sin tinta, no fondo oscuro", () => {
    expect(motivo(extractInk(lienzo(() => 150), W, H))).toBe("sin_tinta");
  });

  it("textura oscura que cubre la hoja: fondo oscuro", () => {
    // Tablero 2px: el umbral local lo lee como tinta en toda la superficie.
    const px = lienzo((x, y) => ((x >> 1) + (y >> 1)) % 2 === 0 ? 10 : 250);
    expect(motivo(extractInk(px, W, H))).toBe("fondo_oscuro");
  });

  it("una firma gruesa que cruza el encuadre no se descarta", () => {
    // Regresión de producción: una firma de marcador que toca los cuatro
    // bordes y ocupa casi toda la imagen se parecía a un marco, y el filtro
    // se la llevaba casi entera (quedaban dos trazos sueltos).
    const px = lienzo(() => 250);
    const grueso = 9;
    for (let x = 0; x < W; x++) {
      for (let d = -grueso; d <= grueso; d++) {
        const y = Math.round(H / 2 + Math.sin((x / W) * Math.PI * 2) * 40) + d;
        if (y < 0 || y >= H) continue;
        const i = (y * W + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 20;
      }
    }
    // Un trozo suelto lejos del trazo: es lo que hacía pasar el descarte.
    for (let y = 30; y < 36; y++) {
      for (let x = 360; x < 372; x++) {
        const i = (y * W + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 20;
      }
    }
    const res = ok(extractInk(px, W, H));
    // El trazo central sigue siendo tinta (no quedó vaciado).
    expect(pixel(res, 200, 120)).toBeGreaterThan(150);
    expect(res.box.w).toBeGreaterThan(W * 0.9);
  });

  it("la mesa oscura que toca el trazo no rompe la firma", () => {
    // Límite conocido: si el trazo cruza el borde de la mesa, la banda y el
    // trazo son la misma región conectada, así que el filtro de borde no
    // puede descartar la banda sin llevarse la firma. Se prefiere conservarla.
    const res = ok(extractInk(firma((x) => (x > W / 2 ? 35 : 230)), W, H));
    const [cx, cy] = CURVA[60];
    expect(pixel(res, cx, cy)).toBeGreaterThan(200);
    expect(porcionGris(res)).toBeLessThan(0.35);
  });

  it("búfer inconsistente: ilegible", () => {
    expect(motivo(extractInk(new Uint8ClampedArray(10), W, H))).toBe("ilegible");
    expect(motivo(extractInk(new Uint8ClampedArray(0), 0, 0))).toBe("ilegible");
  });

  it("cada motivo tiene un mensaje de usuario", () => {
    for (const motivo of [
      "ilegible",
      "sin_tinta",
      "fondo_oscuro",
      "no_es_firma",
    ] as const) {
      expect(INK_MESSAGE[motivo].length).toBeGreaterThan(10);
    }
  });
});

describe("flattenInk — imagen guardada", () => {
  it("sale opaca (sin canal alfa) y recortada a la caja", () => {
    const res = ok(extractInk(firma(200), W, H));
    const plano = flattenInk(res.alpha, W, H, res.box);
    expect(plano.width).toBe(res.box.w);
    expect(plano.height).toBe(res.box.h);
    expect(plano.rgba.length).toBe(plano.width * plano.height * 4);
    for (let i = 3; i < plano.rgba.length; i += 4) expect(plano.rgba[i]).toBe(255);
    // rgb del trazo: gris de tinta, nunca negro puro (el trazo se lee suave)
    expect(plano.rgba[0]).toBeLessThanOrEqual(255);
  });

  it("es idempotente: re-limpiar lo ya limpiado no borra el trazo", () => {
    const primera = ok(extractInk(firma(160), W, H));
    const plano = flattenInk(primera.alpha, W, H, primera.box);
    const segunda = ok(extractInk(plano.rgba, plano.width, plano.height));
    // El servidor vuelve a limpiar lo que ya limpió el cliente.
    const tintaPrimera = primera.alpha.reduce((s, v) => s + (v > 32 ? 1 : 0), 0);
    const tintaSegunda = segunda.alpha.reduce((s, v) => s + (v > 32 ? 1 : 0), 0);
    expect(tintaSegunda).toBeGreaterThan(tintaPrimera * 0.6);
    expect(tintaSegunda).toBeLessThan(tintaPrimera * 1.6);
  });

  it("acepta una caja que excede la imagen sin salirse del búfer", () => {
    const res = ok(extractInk(firma(255), W, H));
    const fuera: InkBox = { x: W - 10, y: H - 10, w: 200, h: 200 };
    const plano = flattenInk(res.alpha, W, H, fuera);
    expect(plano.width).toBe(10);
    expect(plano.height).toBe(10);
  });
});

// --- Enrutador: limpieza directa o cascada realce → limpieza ---------------

function trazoTenue(papel: number, tinta: number) {
  const px = firma(papel);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i] === TINTA) {
        px[i] = tinta;
        px[i + 1] = tinta;
        px[i + 2] = tinta;
      }
    }
  }
  return px;
}

describe("extractSignature — enrutador y cascada", () => {
  it("una firma de contraste normal no pasa por la cascada", () => {
    const directo = ok(extractInk(firma(150), W, H));
    const final = ok(extractSignature(firma(150), W, H));
    expect(final.box).toEqual(directo.box);
  });

  it("una firma muy tenue se recupera realzando niveles antes de limpiar", () => {
    // Foto plana: el trazo es 11% más oscuro que el papel. La limpieza directa
    // no lo ve; la cascada sí.
    const px = trazoTenue(200, 178);
    expect(extractInk(px, W, H).ok).toBe(false);
    const final = ok(extractSignature(px, W, H));
    const [cx, cy] = CURVA[60];
    expect(pixel(final, cx, cy)).toBeGreaterThan(60);
    expect(pixel(final, 0, 0)).toBe(0);
  });

  it("el realce no borra: el papel sigue en blanco y el trazo oscuro", () => {
    const realzado = stretchLevels(trazoTenue(200, 178), W, H);
    const datos = realzado.rgba;
    // esquina (papel) casi blanca
    expect(datos[0]).toBeGreaterThan(240);
    // centro del trazo, claramente más oscuro
    const [cx, cy] = CURVA[60];
    const i = (cy * W + cx) * 4;
    expect(datos[i]).toBeLessThan(120);
  });

  it("rechaza una imagen que no parece una firma y la acepta si se le pide", () => {
    // Bloque macizo (una foto de un objeto): llena su propia caja.
    const bloque = lienzo((x, y) =>
      x > 90 && x < 310 && y > 60 && y < 200 ? 40 : 250
    );
    const estricto = extractSignature(bloque, W, H);
    expect(estricto.ok).toBe(false);
    if (!estricto.ok) expect(estricto.reason).toBe("no_es_firma");

    const permisivo = extractSignature(bloque, W, H, {
      permitirNoFirma: true,
    });
    expect(permisivo.ok).toBe(true);
  });

  it("un fondo con textura que no se puede separar se rechaza como ruido", () => {
    // Papel con manchas pequeñas por todas partes (trama, mármol): la tinta
    // queda hecha de motas, no de trazos. Escribir eso encima de una firma la
    // empeora, así que se rechaza aunque se pida «permitirNoFirma».
    let semilla = 11;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    const px = lienzo((x, y) => {
      const celda = (x >> 1) * 7919 + (y >> 1) * 104729;
      semilla = (celda * 1103515245 + 12345) % 2147483648;
      return azar() < 0.18 ? 95 : 240;
    });
    dibujarTrazo(px);
    const res = extractSignature(px, W, H, { permitirNoFirma: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("ruido");
  });

  it("una firma gruesa no se confunde con un bloque macizo", () => {
    const px = lienzo(() => 250);
    const grueso = 9;
    for (let x = 0; x < W; x++) {
      for (let d = -grueso; d <= grueso; d++) {
        const y = Math.round(H / 2 + Math.sin((x / W) * Math.PI * 2) * 40) + d;
        if (y < 0 || y >= H) continue;
        const i = (y * W + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 20;
      }
    }
    expect(extractSignature(px, W, H).ok).toBe(true);
  });
});
