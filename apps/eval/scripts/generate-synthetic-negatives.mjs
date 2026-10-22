#!/usr/bin/env node
// Genera negativos con licencia propia: documentos renderizados y degradados a
// propósito para parecerse a una foto de móvil (giro, sombra, ruido).
//
// Por qué existe: el corpus real de negativos no crece por decreto, y calibrar
// umbrales exige material con licencia conocida. Un documento sintético cubre
// bien la clase «página impresa»; NO sustituye a una foto de una factura real,
// y los informes lo dicen.
//
// Uso: FIRMA_KIT_EVAL_CORPUS=/ruta pnpm --filter @firma-kit/eval gen:negatives

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

// Texto real, no barras: si los documentos sintéticos fueran rectángulos negros,
// el verificador estaría midiendo densidad de manchas y no documentos. La TTF es
// del sistema; si no está, se cae a barras y el script lo avisa.
const FUENTE = "/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf";
const hayTexto = GlobalFonts.registerFromPath(FUENTE, "Doc");
if (!hayTexto) console.warn("sin TTF del sistema: los documentos saldrán sin texto");

const PALABRAS = [
  "factura", "cliente", "fecha", "total", "subtotal", "impuesto", "descripción",
  "cantidad", "precio", "unidad", "pago", "recibo", "número", "documento",
  "nombre", "dirección", "teléfono", "ciudad", "concepto", "valor", "saldo",
  "cuenta", "referencia", "autorización", "observaciones", "periodo",
];

const corpus = process.env["FIRMA_KIT_EVAL_CORPUS"];
if (!corpus) {
  console.error("Falta FIRMA_KIT_EVAL_CORPUS");
  process.exit(2);
}

const destino = path.join(corpus, "negativas", "sinteticas");
await mkdir(destino, { recursive: true });

const ANCHO = 1200;
const ALTO = 1600;

function prng(semilla) {
  let a = semilla;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

function barrasCodigo(ctx, x, y, ancho, alto, rnd) {
  let cursor = x;
  while (cursor < x + ancho) {
    const w = 2 + Math.floor(rnd() * 6);
    if (rnd() > 0.5) ctx.fillRect(cursor, y, w, alto);
    cursor += w + 2 + Math.floor(rnd() * 4);
  }
}

function bloqueQR(ctx, x, y, lado, rnd) {
  const celda = lado / 12;
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      if (rnd() > 0.5) ctx.fillRect(x + i * celda, y + j * celda, celda, celda);
    }
  }
}

function frase(rnd, palabras) {
  const partes = [];
  for (let i = 0; i < palabras; i++) partes.push(PALABRAS[Math.floor(rnd() * PALABRAS.length)]);
  return partes.join(" ");
}

/** Líneas de texto real, del ancho pedido. */
function lineasTexto(ctx, x, y, ancho, cantidad, rnd, tamano = 20) {
  ctx.font = `${tamano}px Doc`;
  for (let i = 0; i < cantidad; i++) {
    const texto = frase(rnd, 2 + Math.floor(rnd() * 4));
    ctx.fillText(texto, x, y + i * (tamano + 8), ancho);
  }
}

function encabezado(ctx, x, y, texto, tamano = 34) {
  ctx.font = `${tamano}px Doc`;
  ctx.fillText(texto, x, y);
}

function numero(rnd, digitos = 5) {
  let n = "";
  for (let i = 0; i < digitos; i++) n += Math.floor(rnd() * 10);
  return n;
}

const GENERADORES = {
  // Factura: cabecera, tabla de conceptos con totales, código de barras.
  factura(ctx, rnd) {
    encabezado(ctx, 80, 100, `FACTURA ${numero(rnd, 6)}`);
    lineasTexto(ctx, 80, 150, 380, 3, rnd, 18);
    lineasTexto(ctx, 700, 150, 420, 3, rnd, 18);
    ctx.fillRect(80, 270, 1040, 3);
    ctx.font = "bold 20px Doc";
    ctx.fillText("concepto", 80, 300);
    ctx.fillText("cantidad", 720, 300);
    ctx.fillText("valor", 960, 300);
    ctx.font = "18px Doc";
    for (let fila = 0; fila < 14; fila++) {
      const y = 336 + fila * 52;
      ctx.fillText(frase(rnd, 3), 80, y);
      ctx.fillText(String(1 + Math.floor(rnd() * 9)), 730, y);
      ctx.fillText(numero(rnd, 6), 960, y);
      if (fila % 2 === 0) ctx.fillRect(80, y + 16, 1040, 1);
    }
    lineasTexto(ctx, 780, 1100, 320, 3, rnd, 20);
    barrasCodigo(ctx, 80, 1250, 500, 90, rnd);
    bloqueQR(ctx, 950, 1200, 160, rnd);
  },

  // Formulario: campos con etiqueta y caja, dos columnas.
  formulario(ctx, rnd) {
    ctx.fillRect(80, 70, 520, 26);
    for (let fila = 0; fila < 12; fila++) {
      const y = 160 + fila * 100;
      for (const x of [80, 620]) {
        ctx.font = "16px Doc";
        ctx.fillText(PALABRAS[Math.floor(rnd() * PALABRAS.length)], x, y);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y + 26, 460, 44);
      }
    }
    ctx.strokeRect(80, 1400, 500, 120);
    lineasTexto(ctx, 100, 1430, 300, 2, rnd);
  },

  // Recibo: tira estrecha, líneas punteadas y columna de precios.
  recibo(ctx, rnd) {
    const margen = 260;
    encabezado(ctx, margen, 100, "RECIBO DE PAGO", 26);
    ctx.font = "17px Doc";
    for (let i = 0; i < 40; i++) {
      const y = 170 + i * 34;
      ctx.fillText(frase(rnd, 2), margen, y, 460);
      ctx.fillText(numero(rnd, 4), 780, y);
      if (i % 7 === 0) {
        for (let x = margen; x < margen + 640; x += 16) ctx.fillRect(x, y + 20, 8, 2);
      }
    }
    barrasCodigo(ctx, margen + 60, 1300, 480, 80, rnd);
  },

  // Pantallazo: barra superior, tarjetas, botones y líneas de texto.
  pantallazo(ctx, rnd) {
    ctx.fillRect(0, 0, ANCHO, 90);
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(720, 30, 360, 30);
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const y = 140 + i * 280;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.strokeRect(60, y, 1080, 240);
      lineasTexto(ctx, 100, y + 60, 900, 3, rnd, 20);
      ctx.font = "18px Doc";
      ctx.fillText("continuar", 100, y + 200);
    }
    ctx.fillRect(60, 1520, 1080, 3);
  },

  // Hoja cuadriculada vacía: solo renglones, sin tinta encima.
  "papel-cuadricula"(ctx) {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    for (let y = 40; y < ALTO; y += 48) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(ANCHO - 40, y);
      ctx.stroke();
    }
    for (let x = 40; x < ANCHO; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, ALTO - 40);
      ctx.stroke();
    }
  },

  // Garabato: trazos densos que NO son una firma (blobs y verticales).
  garabato(ctx, rnd) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000";
    for (let i = 0; i < 40; i++) {
      const x = 150 + rnd() * 900;
      const y = 300 + rnd() * 1000;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let p = 0; p < 5; p++) ctx.lineTo(x + (rnd() - 0.5) * 400, y + (rnd() - 0.5) * 400);
      ctx.stroke();
    }
  },

  // Tabla numérica densa: mucho texto oscuro, el caso que más se parece.
  tabla(ctx, rnd) {
    const columnas = 8;
    const ancho = 1000 / columnas;
    ctx.font = "16px Doc";
    for (let fila = 0; fila < 30; fila++) {
      const y = 100 + fila * 48;
      for (let c = 0; c < columnas; c++) {
        ctx.fillText(numero(rnd, 3 + Math.floor(rnd() * 4)), 100 + c * ancho, y);
      }
      ctx.fillRect(100, y + 14, 1000, 1);
    }
  },
};

/** Degrada el documento como lo haría una foto: giro, sombra y ruido. */
function degradar(canvas, rnd) {
  const salida = createCanvas(ANCHO, ALTO);
  const ctx = salida.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.save();
  ctx.translate(ANCHO / 2, ALTO / 2);
  ctx.rotate(((rnd() - 0.5) * 6 * Math.PI) / 180); // ±3°
  ctx.drawImage(canvas, -ANCHO / 2, -ALTO / 2);
  ctx.restore();

  // Sombra diagonal: la luz de una foto real nunca es uniforme.
  const sombra = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
  sombra.addColorStop(0, "rgba(0,0,0,0)");
  sombra.addColorStop(1, `rgba(0,0,0,${0.08 + rnd() * 0.1})`);
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Ruido: grano de sensor y artefactos de JPEG.
  const imagen = ctx.getImageData(0, 0, ANCHO, ALTO);
  for (let i = 0; i < imagen.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    imagen.data[i] = Math.max(0, Math.min(255, imagen.data[i] + n));
    imagen.data[i + 1] = imagen.data[i];
    imagen.data[i + 2] = imagen.data[i];
  }
  ctx.putImageData(imagen, 0, 0);
  return salida;
}

const KINDS = Object.keys(GENERADORES);
let total = 0;
for (const [indice, kind] of KINDS.entries()) {
  for (let copia = 0; copia < 4; copia++) {
    const rnd = prng((indice + 1) * 1000 + copia * 37 + 7);
    const canvas = createCanvas(ANCHO, ALTO);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.fillStyle = "#111111";
    GENERADORES[kind](ctx, rnd);
    const foto = degradar(canvas, rnd);
    const nombre = `sintetica-${kind}-${String(copia).padStart(2, "0")}.jpg`;
    await writeFile(path.join(destino, nombre), foto.toBuffer("image/jpeg", 80));
    total++;
  }
}
console.log(`${total} negativas sintéticas en ${destino}`);
