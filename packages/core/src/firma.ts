// Punto de entrada único de los cuatro modos.
//
// Todo lo que aquí ocurre es puro salvo el encoder: decodificar la imagen y
// capturarla es del adaptador, y por eso la entrada ya llega como `Bitmap`. La
// verificación visual entra por el puerto `Verificador`, que corre en el proceso
// del llamador (la imagen de una cédula nunca sale de su infraestructura).

import { scaleToMaxSide, scaleToWidth } from "./imagen.js";
import { mensajeRechazo } from "./mensajes/es.js";
import { rasterizeStroke, type PuntoTrazo } from "./modos/dibujar.js";
import {
  layoutEscribir,
  type MedidorTexto,
  type TextRasterizer,
} from "./modos/escribir.js";
import { extractSignature, flattenInk } from "./tinta/pixeles.js";
import type {
  Bitmap,
  EncodePng,
  Firma,
  ModoFirma,
  MotivoRechazo,
  OpcionesFirma,
  ResultadoFirma,
} from "./tipos.js";

/** De dónde sale la firma. El adaptador ya decodificó lo que haga falta. */
export type EntradaFirma =
  // Un miembro por modo: con un discriminante `"subir" | "foto"` TypeScript no
  // puede descartar el miembro al comprobar `modo === "dibujar"`.
  | { modo: "subir"; imagen: Bitmap }
  | { modo: "foto"; imagen: Bitmap }
  | {
      modo: "dibujar";
      puntos: PuntoTrazo[];
      lienzo: { width: number; height: number };
    }
  | {
      modo: "escribir";
      texto: string;
      lienzo: { width: number; height: number };
      medidor: MedidorTexto;
      rasterizer: TextRasterizer;
    };

/** Ancho del PNG final: una celda impresa de ~90px a 300dpi. */
const ANCHO_MAXIMO = 900;
/** Lado mayor que se analiza: memoria de un móvil de gama media. */
const LADO_ANALISIS = 1200;
/** Por debajo de este gris, un píxel cuenta como tinta en un lienzo limpio. */
const GRIS_TINTA = 240;

function hayTinta(imagen: Bitmap): boolean {
  for (let i = 0; i < imagen.data.length; i += 4) {
    if (imagen.data[i]! < GRIS_TINTA) return true;
  }
  return false;
}

/**
 * Convierte cualquiera de las cuatro formas de firmar en un PNG opaco de tinta
 * sobre blanco, o en un rechazo con su motivo y su mensaje.
 */
export async function firmar(
  entrada: EntradaFirma,
  encoder: EncodePng,
  opciones: OpcionesFirma = {}
): Promise<ResultadoFirma> {
  const rechazo = (motivo: MotivoRechazo): ResultadoFirma => ({
    ok: false,
    motivo,
    mensaje: mensajeRechazo(motivo, opciones.mensajes),
  });

  let plano: Bitmap;
  let realzada: true | undefined;

  if (entrada.modo === "subir" || entrada.modo === "foto") {
    // Se clasifica la imagen ORIGINAL, no la limpia: al binarizar, una cédula se
    // vuelve "página con texto" y se pierde la señal que delata que no es firma.
    if (opciones.verificador) {
      try {
        const veredicto = await opciones.verificador.verificar(entrada.imagen);
        if (!veredicto.esFirma) return rechazo("no_es_firma");
      } catch {
        // El modelo no está descargado o falló. Verificar es una salvaguarda
        // extra: no puede dejar a una persona sin poder firmar.
      }
    }
    const analisis = scaleToMaxSide(
      entrada.imagen,
      opciones.ladoAnalisis ?? LADO_ANALISIS
    );
    const res = extractSignature(analisis.data, analisis.width, analisis.height);
    if (!res.ok) return rechazo(res.reason);
    const limpiado = flattenInk(res.alpha, res.width, res.height, res.box);
    plano = { data: limpiado.rgba, width: limpiado.width, height: limpiado.height };
    realzada = res.realzada;
  } else {
    let dibujado: Bitmap;
    if (entrada.modo === "dibujar") {
      dibujado = rasterizeStroke(entrada.puntos, entrada.lienzo);
    } else {
      const layout = layoutEscribir(
        entrada.texto,
        entrada.lienzo,
        entrada.medidor
      );
      if (!layout) return rechazo("vacia");
      const pintado = entrada.rasterizer.rasterizar(
        layout.lineas,
        layout.estilo,
        layout.interlineado,
        entrada.lienzo
      );
      // Sin fuente no hay texto: es un estado del sistema, no un error de la
      // persona, y por eso tiene su propio motivo.
      if (!pintado) return rechazo("fuente_no_disponible");
      dibujado = pintado;
    }
    if (!hayTinta(dibujado)) return rechazo("vacia");
    const res = extractSignature(dibujado.data, dibujado.width, dibujado.height);
    if (!res.ok) return rechazo(res.reason);
    const limpiado = flattenInk(res.alpha, res.width, res.height, res.box);
    plano = { data: limpiado.rgba, width: limpiado.width, height: limpiado.height };
    realzada = res.realzada;
  }

  const final = scaleToWidth(plano, opciones.anchoMaximo ?? ANCHO_MAXIMO);
  const firma: Firma = {
    modo: entrada.modo as ModoFirma,
    png: await encoder(final),
    ancho: final.width,
    alto: final.height,
    creadaEn: new Date().toISOString(),
  };
  // `exactOptionalPropertyTypes`: la clave solo existe cuando hay algo que decir.
  return realzada
    ? { ok: true, firma: { ...firma, realzada } }
    : { ok: true, firma };
}
