// Matemática pura de limpieza de firma: no toca DOM, canvas ni filesystem,
// así el mismo algoritmo corre en el navegador (canvas), en el servidor
// (sharp/sharp-less) y en tests con imágenes sintéticas.
//
// Portado de registro_asistencia, donde se validó contra 1018 firmas reales en
// producción: sustituye al umbral absoluto que imprimía el papel gris como
// recuadro oscuro.
//
// El problema que resuelve: una foto de la firma trae papel, sombra y mesa.
// El umbral absoluto anterior ((235 - lum) * 2.2) convertía un papel gris
// (lum 150) en alfa 187, es decir una losa gris oscura en el PDF. Aquí el
// umbral es local (Sauvola sobre media y desviación de una ventana del tamaño
// del papel): el papel queda transparente aunque esté gris, sombreado o
// fotografiado con poca luz, y solo el trazo (claramente más oscuro que su
// entorno) se convierte en tinta.

/** Nivel de gris de la tinta impresa (mismo stroke que el canvas rendered). */
// Los accesos indexados de este módulo están acotados por construcción
// (n = width * height y buffers del mismo tamaño); las aserciones `!` que
// aparecen más abajo declaran esa garantía para `noUncheckedIndexedAccess`.
export const INK_GRAY = 20;

/** Alfa mínimo que cuenta como tinta para coverage y bounds. */
const INK_ALPHA = 32;

/** Motivos de rejection: el llamador los traduce a un message de usuario. */
export type InkReason =
  | "unreadable"
  | "no_ink"
  | "dark_background"
  | "not_a_signature"
  | "noise";

export type InkBox = { x: number; y: number; w: number; h: number };

export type InkResult =
  | {
      ok: true;
      /** Alfa por píxel (0 = paper, 255 = tinta) del tamaño de la input. */
      alpha: Uint8ClampedArray;
      /** Caja del stroke con margen, ya recortada a la image. */
      box: InkBox;
      width: number;
      height: number;
      /**
       * true si el result aprobado salió de la cascade (realce de niveles).
       * Permite auditar después por qué una signature se ve más contrastada que la
       * foto original.
       */
      enhanced?: true;
    }
  | { ok: false; reason: InkReason };

export type InkOptions = {
  /** Sensibilidad de Sauvola: más height = más píxeles cuentan como tinta. */
  k?: number;
  /**
   * Acepta el result aunque no parezca una signature. Lo usa el reproceso
   * histórico: su objetivo es mejorar lo ya guardado, no rechazar evidencia.
   */
  allowNonSignature?: boolean;
  /** Radio de la ventana local en píxeles (por defecto ~10% del lado menor). */
  radius?: number;
  /** Cobertura máxima aceptable de tinta (fracción del área). */
  maxCoverage?: number;
};


/**
 * Extrae la tinta de una image RGBA (composición sobre blanco incluida).
 * Devuelve el alfa por píxel y la bounds del stroke, o el reason por el que la
 * image no sirve como signature. Nunca devuelve una image con background oscuro.
 */
export function extractInk(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: InkOptions = {}
): InkResult {
  const n = width * height;
  if (n <= 0 || rgba.length < n * 4) return { ok: false, reason: "unreadable" };

  const k = options.k ?? 0.2;
  const radius =
    options.radius ?? Math.max(4, Math.round(Math.min(width, height) * 0.1));
  const maxCoverage = options.maxCoverage ?? 0.35;

  // 1. Luminancia compuesta sobre blanco: un PNG con transparencia (o con
  //    alfa suave) no falsea el nivel del papel.
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const a = rgba[j + 3]! / 255;
    const l =
      0.299 * rgba[j]! + 0.587 * rgba[j + 1]! + 0.114 * rgba[j + 2]!;
    lum[i] = l * a + 255 * (1 - a);
  }

  // 2. Media y desviación locales (ventana del tamaño del papel).
  const { mean, dev } = localStats(lum, width, height, radius);

  // 3. Umbral de Sauvola: T = m * (1 + k * (s / R - 1)). Es invariante a la
  //    escala de grises: papel a 150 y papel a 250 dan el mismo resultado.
  const alpha = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const m = mean[i]!;
    const t = m * (1 + k * (dev[i]! / 128 - 1));
    const ramp = Math.max(6, t * 0.12);
    const a = (t - lum[i]!) / ramp;
    alpha[i] = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * 255);
  }

  // 4. Limpieza de motas (noise JPEG, polvo): un píxel de tinta necesita al
  //    menos dos vecinos de tinta. Los trazos finos sobreviven; el noise no.
  const clean = despeckle(alpha, width, height);

  // 5. Marco y mesa: la tinta pegada al borde que además cruza la imagen es
  //    el borde de la foto o de la mesa, no la firma. Una ventana local ve el
  //    papel alrededor de una banda oscura estrecha y la marca como tinta; el
  //    filtro la descarta sin tocar un trazo que toca el borde por encuadre.
  dropBorderFrame(clean, width, height);

  // 6. Corte duro por debajo del umbral de tinta: el antialiasing más tenue se
  //    descarta y el papel queda blanco puro al aplanar (255 exacto), no un
  //    velo de gris.
  for (let i = 0; i < n; i++) if (clean[i]! <= INK_ALPHA) clean[i] = 0;

  const count = countInk(clean);
  if (count < 12) return { ok: false, reason: "no_ink" };
  if (count / n > maxCoverage) return { ok: false, reason: "dark_background" };

  const box = inkBox(clean, width, height);
  if (!box) return { ok: false, reason: "no_ink" };
  return { ok: true, alpha: clean, box, width, height };
}

/**
 * Enrutador de la signature por image.
 *
 * 1. Intenta la limpieza directa (Sauvola). Si el result retiene una parte
 *    real de la estructura oscura del original, ese es el result.
 * 2. Si no (foto plana: el stroke es apenas más oscuro que su background), primero
 *    se **realzan los niveles** y se vuelve a clear sobre esa versión. La
 *    cascade revela el stroke y la limpieza quita el background que el realce
 *    también amplificó.
 * 3. Si el result no parece una signature (un bloque macizo, una foto de otra
 *    cosa), se rechaza con su reason — salvo que el llamador pida aceptarlo
 *    (reproceso de lo ya guardado).
 */
export function extractSignature(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: InkOptions = {}
): InkResult {
  const direct = extractInk(rgba, width, height, options);
  const directConfidence = direct.ok
    ? confidence(rgba, width, height, direct)
    : 0;
  if (direct.ok && directConfidence >= MIN_CONFIDENCE) {
    return signatureGate(direct, options);
  }

  // Cascada: realzar niveles y volver a limpiar sobre la versión realzada.
  const enhanced = stretchLevels(rgba, width, height);
  const cascade = extractInk(
    enhanced.rgba,
    enhanced.width,
    enhanced.height,
    options
  );
  if (!cascade.ok) return direct.ok ? signatureGate(direct, options) : cascade;

  // Se queda el intento que retiene más estructura del original: en algunas
  // fotos el realce amplifica el noise y la limpieza directa era mejor.
  const cascadeConfidence = confidence(rgba, width, height, cascade);
  const chosen =
    direct.ok && directConfidence >= cascadeConfidence ? direct : cascade;
  const final = signatureGate(chosen, options);
  // Solo se marca cuando lo aprobado viene del realce: si la limpieza directa
  // ganó, la firma guardada es la de la foto sin tocar.
  if (final.ok && chosen === cascade) return { ...final, enhanced: true };
  return final;
}

/** Cuánto de la estructura oscura del original sobrevive como tinta. */
const MIN_CONFIDENCE = 0.12;
/** Densidad de tinta por encima de la cual no es un stroke, es una image. */
const MAX_DENSITY = 0.45;
/** Un objeto macizo ocupa su bounds; un stroke de signature la deja llena de aire. */
const MAX_SOLIDITY = 0.45;
const MIN_BLOCK_AREA = 0.06;
/** Fracción de tinta que puede estar en motas sueltas (textura del background). */
const MAX_NOISE = 0.45;
/** Área hasta la que una región es una mota de textura y no un stroke. */
const MAX_SPECK_AREA = 24;

function confidence(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  res: Extract<InkResult, { ok: true }>
): number {
  const lum = luminance(rgba, width * height);
  if (!lum) return 1;
  const paper = percentile(lum, 0.9);
  const umbral = paper * 0.55;
  let oscuro = 0;
  for (let i = 0; i < lum.length; i++) if (lum[i]! < umbral) oscuro++;
  if (oscuro === 0) return 1;
  return countInk(res.alpha) / oscuro;
}

function signatureGate(
  res: Extract<InkResult, { ok: true }>,
  options: InkOptions
): InkResult {
  const { alpha, width, height } = res;
  const n = width * height;
  const tinta = countInk(alpha);
  if (tinta === 0) return { ok: false, reason: "no_ink" };
  const inkRegions = regions(alpha, width, height);

  // Textura del fondo: si la mayor parte de la «tinta» son motas sueltas, el
  // fondo no se pudo separar del trazo. No se puede forzar: escribir esto
  // encima de una firma la empeora (es el caso del papel con trama).
  let motas = 0;
  for (const r of inkRegions) if (r.area <= MAX_SPECK_AREA) motas += r.area;
  if (motas / tinta > MAX_NOISE) return { ok: false, reason: "noise" };

  // A partir de aquí solo se pregunta «¿parece una firma?», y el reproceso
  // histórico puede pedir que no se rechace por eso.
  if (options.allowNonSignature) return res;
  if (tinta / n > MAX_DENSITY) return { ok: false, reason: "not_a_signature" };
  for (const r of inkRegions) {
    const bounds = (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
    if (r.area >= n * MIN_BLOCK_AREA && r.area / bounds >= MAX_SOLIDITY) {
      return { ok: false, reason: "not_a_signature" };
    }
  }
  return res;
}

/**
 * Realce de niveles (auto-niveles) SIN binarizar: divide por el background local,
 * estira los percentiles reales de la image y aplica gamma. No descarta
 * ningún píxel, así que nunca borra un stroke; su peor result es una signature
 * gris sobre background casi blanco.
 */
export function stretchLevels(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: { gamma?: number; radius?: number } = {}
): { rgba: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const n = width * height;
  const lum = luminance(rgba, n) ?? new Float32Array(n).fill(255);
  const radius =
    options.radius ?? Math.max(6, Math.round(Math.min(width, height) * 0.06));
  const { mean } = localStats(lum, width, height, radius);

  // Oscuridad relativa al fondo local, en 0..255 (255 = igual al papel).
  const rel = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rel[i] = Math.min(1, lum[i]! / Math.max(mean[i]!, 1)) * 255;
  }
  // Cola oscura = extremo bajo (percentil 2): si la firma ocupa más que eso,
  // cae dentro. Ventana alta = papel (percentil 98).
  const pBajo = percentile(rel, 0.01);
  const pAlto = percentile(rel, 0.98);
  const gamma = options.gamma ?? 1.4;
  const rango = pAlto - pBajo;

  const out = new Uint8ClampedArray(n * 4);
  // Sin contraste que revelar (todo el fondo en el mismo nivel) el realce no
  // tiene nada que hacer: se devuelve la imagen como estaba en vez de
  // inventar contraste a partir del noise.
  if (rango < 10) {
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      const v = Math.round(Math.min(255, Math.max(0, lum[i]!)));
      out[j] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = 255;
    }
    return { rgba: out, width, height };
  }

  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (rel[i]! - pBajo) / rango));
    const v = Math.round(255 * Math.pow(t, gamma));
    const j = i * 4;
    out[j] = v;
    out[j + 1] = v;
    out[j + 2] = v;
    out[j + 3] = 255;
  }
  return { rgba: out, width, height };
}

/**
 * Aplana el stroke sobre blanco (sin alfa) y lo recorta a la bounds: es la
 * image que se guarda y se imprime. Cualquier consumidor (Excel, PDF, correo,
 * visor) la muestra sobre blanco sin depender de cómo compone la transparencia.
 */
export function flattenInk(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  box: InkBox
): { rgba: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const outW = Math.max(1, Math.min(box.w, width - box.x));
  const outH = Math.max(1, Math.min(box.h, height - box.y));
  const rgba = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const src = (y + box.y) * width + box.x;
    const dst = y * outW;
    for (let x = 0; x < outW; x++) {
      const a = alpha[src + x]! / 255;
      const v = Math.round(INK_GRAY * a + 255 * (1 - a));
      const o = (dst + x) * 4;
      rgba[o] = v;
      rgba[o + 1] = v;
      rgba[o + 2] = v;
      rgba[o + 3] = 255;
    }
  }
  return { rgba, width: outW, height: outH };
}

/** Cuenta los píxeles de tinta significativos (para el informe de reproceso). */
export function countInk(alpha: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i]! > INK_ALPHA) count++;
  return count;
}

// --- Internos -------------------------------------------------------------

/** Luminancia compuesta sobre blanco: el alfa no falsea el tier del paper. */
function luminance(
  rgba: Uint8ClampedArray | Uint8Array,
  n: number
): Float32Array | null {
  if (rgba.length < n * 4) return null;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const a = rgba[j + 3]! / 255;
    const l =
      0.299 * rgba[j]! + 0.587 * rgba[j + 1]! + 0.114 * rgba[j + 2]!;
    lum[i] = l * a + 255 * (1 - a);
  }
  return lum;
}

/** Valor por debajo del cual remaining la fracción `q` de los píxeles. */
function percentile(valores: Float32Array, q: number): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < valores.length; i++) {
    const v = Math.min(255, Math.max(0, Math.round(valores[i]!)));
    hist[v] = hist[v]! + 1;
  }
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v]!;
    if (acc / valores.length >= q) return v;
  }
  return 255;
}

type Region = {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  touchesBorder: boolean;
};

/** Regiones de tinta conectadas (4 vecinos) con su área y su bounds. */
function regions(
  alpha: Uint8ClampedArray,
  width: number,
  height: number
): Region[] {
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const found: Region[] = [];
  const enqueueAt = (i: number, head: number) => {
    if (seen[i]! || alpha[i]! <= INK_ALPHA) return head;
    seen[i] = 1;
    queue[head] = i;
    return head + 1;
  };
  for (let start = 0; start < alpha.length; start++) {
    if (seen[start]! || alpha[start]! <= INK_ALPHA) continue;
    let head = 0;
    let tail = enqueueAt(start, 0);
    const r: Region = {
      area: 0,
      minX: width,
      maxX: -1,
      minY: height,
      maxY: -1,
      touchesBorder: false,
    };
    while (head < tail) {
      const i = queue[head++]!;
      const x = i % width;
      const y = (i - x) / width;
      r.area++;
      if (x < r.minX) r.minX = x;
      if (x > r.maxX) r.maxX = x;
      if (y < r.minY) r.minY = y;
      if (y > r.maxY) r.maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        r.touchesBorder = true;
      }
      if (x > 0) tail = enqueueAt(i - 1, tail);
      if (x < width - 1) tail = enqueueAt(i + 1, tail);
      if (y > 0) tail = enqueueAt(i - width, tail);
      if (y < height - 1) tail = enqueueAt(i + width, tail);
    }
    found.push(r);
  }
  return found;
}

function clampIndex(v: number, max: number) {
  return v < 0 ? 0 : v > max ? max : v;
}

/** Suma deslizante separable (horizontal y luego vertical, en el sitio). */
function boxSum(
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
  out: Float32Array
) {
  const pref = new Float32Array(Math.max(width, height) + 1);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    pref[0] = 0;
    for (let x = 0; x < width; x++) pref[x + 1] = pref[x]! + src[row + x]!;
    for (let x = 0; x < width; x++) {
      const from = clampIndex(x - radius, width);
      const to = clampIndex(x + radius + 1, width);
      out[row + x] = pref[to]! - pref[from]!;
    }
  }
  const col = new Float32Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) col[y] = out[y * width + x]!;
    pref[0] = 0;
    for (let y = 0; y < height; y++) pref[y + 1] = pref[y]! + col[y]!;
    for (let y = 0; y < height; y++) {
      const from = clampIndex(y - radius, height);
      const to = clampIndex(y + radius + 1, height);
      out[y * width + x] = pref[to]! - pref[from]!;
    }
  }
}

function localStats(
  lum: Float32Array,
  width: number,
  height: number,
  radius: number
) {
  const n = width * height;
  const sum = new Float32Array(n);
  boxSum(lum, width, height, radius, sum);
  const squares = new Float32Array(n);
  for (let i = 0; i < n; i++) squares[i] = lum[i]! * lum[i]!;
  const sumSq = new Float32Array(n);
  boxSum(squares, width, height, radius, sumSq);

  // En los bordes la ventana se recorta: el área real es menor que
  // (2r+1)². Dividir siempre por el área completa deflactaba media y
  // desviación justo en el borde, y ahí la tinta del marco o de la mesa
  // dejaba de detectarse (el filtro de marco no tenía dónde sembrar).
  const countX = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    countX[x] =
      Math.min(width, x + radius + 1) - Math.max(0, x - radius);
  }
  const mean = new Float32Array(n);
  const dev = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    const countY = Math.min(height, y + radius + 1) - Math.max(0, y - radius);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const area = countX[x]! * countY;
      const m = sum[i]! / area;
      mean[i] = m;
      const variance = sumSq[i]! / area - m * m;
      dev[i] = variance > 0 ? Math.sqrt(variance) : 0;
    }
  }
  return { mean, dev };
}

// Pinta a 0 la tinta conectada al borde cuando esa región cruza la imagen
// (≥80% de una dimensión): es el borde de la foto o la línea de la mesa, no la
// firma. Una ventana local ve papel alrededor de una banda oscura estrecha y
// la marca como tinta; este filtro la descarta. Si el filtro se llevara toda
// la tinta (una firma que roza el borde por un encuadre apretado) no se aplica:
// se prefiere la firma con su borde antes que un rechazo sin explicación.
function dropBorderFrame(
  alpha: Uint8ClampedArray,
  width: number,
  height: number
) {
  const total = countInk(alpha);
  if (total === 0) return;

  const marked = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tailIdx = 0;
  const enqueue = (i: number) => {
    if (marked[i]! || alpha[i]! <= INK_ALPHA) return;
    marked[i] = 1;
    queue[tailIdx++] = i;
  };
  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  let markedCount = 0;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  while (head < tailIdx) {
    const i = queue[head++]!;
    markedCount++;
    const x = i % width;
    const y = (i - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x > 0) enqueue(i - 1);
    if (x < width - 1) enqueue(i + 1);
    if (y > 0) enqueue(i - width);
    if (y < height - 1) enqueue(i + width);
  }
  if (markedCount === 0) return;

  const crosses =
    (maxX - minX + 1) >= width * 0.8 || (maxY - minY + 1) >= height * 0.8;
  if (!crosses || markedCount < 24) return;
  // No se descarta cuando la región del borde ES la firma: una firma gruesa
  // que cruza el encuadre (o que toca el borde con casi todo su trazo) se ve
  // igual que un marco para este filtro. Se exige que lo que quedaría sea una
  // firma plausible —no un trozo suelto— para aceptar el descarte. Sin esta
  // proporción, una firma grande se vaciaba casi por completo.
  const remaining = total - markedCount;
  if (remaining < 12 || remaining < total * 0.05) return;
  for (let i = 0; i < marked.length; i++) if (marked[i]) alpha[i] = 0;
}

function despeckle(
  alpha: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(alpha);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alpha[i]! <= INK_ALPHA) continue;
      let vecinos = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (alpha[yy * width + xx]! > INK_ALPHA) vecinos++;
        }
      }
      if (vecinos < 2) out[i] = 0;
    }
  }
  return out;
}

function inkBox(
  alpha: Uint8ClampedArray,
  width: number,
  height: number
): InkBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  // Margen del prototipo: 8% horizontal, 12% vertical + 6px de aire.
  const w0 = maxX - minX + 1;
  const h0 = maxY - minY + 1;
  const padX = Math.round(w0 * 0.08) + 6;
  const padY = Math.round(h0 * 0.12) + 6;
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  return {
    x,
    y,
    w: Math.min(width - x, w0 + padX * 2),
    h: Math.min(height - y, h0 + padY * 2),
  };
}
