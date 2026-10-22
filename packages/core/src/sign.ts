// Punto de entrada único de los cuatro modos.
//
// Todo lo que aquí ocurre es puro salvo el encoder: decodificar la imagen y
// capturarla es del adaptador, y por eso la entrada ya llega como `Bitmap`. La
// verificación visual entra por el puerto `Verificador`, que corre en el proceso
// del llamador (la imagen de una cédula nunca sale de su infraestructura).

import { scaleToMaxSide, scaleToWidth } from "./image.js";
import { rejectionMessage } from "./messages/index.js";
import {
  rasterizeStroke,
  type StrokeOptions,
  type StrokePoint,
} from "./modes/draw.js";
import {
  layoutTypedName,
  type TextMeasurer,
  type TextRasterizer,
  type TypeFont,
} from "./modes/type.js";
import { extractSignature, flattenInk } from "./ink/pixels.js";
import type {
  Bitmap,
  PngEncoder,
  Signature,
  SignatureMode,
  RejectionReason,
  SignatureOptions,
  SignatureResult,
} from "./types.js";

/** De dónde sale la signature. El adaptador ya decodificó lo que haga falta. */
export type SignatureInput =
  // Un miembro por modo: con un discriminante `"subir" | "foto"` TypeScript no
  // puede descartar el miembro al comprobar `modo === "dibujar"`.
  | { mode: "upload"; image: Bitmap }
  | { mode: "camera"; image: Bitmap }
  | {
      mode: "draw";
      points: StrokePoint[];
      canvas: { width: number; height: number };
      /** Grosor, suavizado y color del trazo. Sin esto, los del paquete. */
      stroke?: StrokeOptions;
    }
  | {
      mode: "type";
      text: string;
      canvas: { width: number; height: number };
      measurer: TextMeasurer;
      rasterizer: TextRasterizer;
      /** Cursiva elegida. Sin ella, el layout usa la de por defecto (Caveat). */
      font?: TypeFont;
    };

/** Ancho del PNG final: una celda impresa de ~90px a 300dpi. */
const MAX_WIDTH = 900;
/** Lado mayor que se analiza: memoria de un móvil de gama media. */
const MAX_ANALYSIS_SIDE = 1200;
/** Por debajo de este gris, un píxel cuenta como tinta en un canvas cleanName. */
const INK_THRESHOLD = 240;

function hasInk(image: Bitmap): boolean {
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i]! < INK_THRESHOLD) return true;
  }
  return false;
}

/**
 * Convierte cualquiera de las cuatro formas de sign en un PNG opaco de tinta
 * sobre blanco, o en un rejection con su reason y su message.
 */
export async function sign(
  input: SignatureInput,
  encoder: PngEncoder,
  options: SignatureOptions = {}
): Promise<SignatureResult> {
  const rejection = (reason: RejectionReason): SignatureResult => ({
    ok: false,
    reason,
    message: rejectionMessage(reason, options.locale ?? "en", options.messages),
  });

  let flattened: Bitmap;
  let enhanced: true | undefined;

  if (input.mode === "upload" || input.mode === "camera") {
    // Se clasifica la imagen ORIGINAL, no la limpia: al binarizar, una cédula se
    // vuelve "página con texto" y se pierde la señal que delata que no es firma.
    if (options.verifier) {
      try {
        const veredicto = await options.verifier.verify(input.image);
        if (!veredicto.isSignature) return rejection("not_a_signature");
      } catch {
        // El modelo no está descargado o falló. Verificar es una salvaguarda
        // extra: no puede dejar a una persona sin poder firmar.
      }
    }
    const analysis = scaleToMaxSide(
      input.image,
      options.maxAnalysisSide ?? MAX_ANALYSIS_SIDE
    );
    const res = extractSignature(analysis.data, analysis.width, analysis.height);
    if (!res.ok) return rejection(res.reason);
    const cleanedBitmap = flattenInk(res.alpha, res.width, res.height, res.box);
    flattened = { data: cleanedBitmap.rgba, width: cleanedBitmap.width, height: cleanedBitmap.height };
    enhanced = res.enhanced;
  } else {
    let rendered: Bitmap;
    if (input.mode === "draw") {
      rendered = rasterizeStroke(input.points, input.canvas, input.stroke ?? {});
    } else {
      const layout = layoutTypedName(
        input.text,
        input.canvas,
        input.measurer,
        input.font ? { family: input.font } : {}
      );
      if (!layout) return rejection("empty");
      const painted = input.rasterizer.rasterize(
        layout.lines,
        layout.style,
        layout.lineHeight,
        input.canvas
      );
      // Sin fuente no hay texto: es un estado del sistema, no un error de la
      // persona, y por eso tiene su propio motivo.
      if (!painted) return rejection("font_unavailable");
      rendered = painted;
    }
    if (!hasInk(rendered)) return rejection("empty");
    const res = extractSignature(rendered.data, rendered.width, rendered.height);
    if (!res.ok) return rejection(res.reason);
    const cleanedBitmap = flattenInk(res.alpha, res.width, res.height, res.box);
    flattened = { data: cleanedBitmap.rgba, width: cleanedBitmap.width, height: cleanedBitmap.height };
    enhanced = res.enhanced;
  }

  const final = scaleToWidth(flattened, options.maxWidth ?? MAX_WIDTH);
  const signature: Signature = {
    mode: input.mode as SignatureMode,
    png: await encoder(final),
    width: final.width,
    height: final.height,
    createdAt: new Date().toISOString(),
  };
  // `exactOptionalPropertyTypes`: la clave solo existe cuando hay algo que decir.
  return enhanced
    ? { ok: true, signature: { ...signature, enhanced } }
    : { ok: true, signature };
}
