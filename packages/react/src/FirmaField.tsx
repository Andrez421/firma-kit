"use client";

// <FirmaField />: las cuatro formas de firmar en un componente controlable y
// accesible. La lógica de firma vive en `@firma-kit/core`; aquí solo está el
// DOM, el estado y los puertos de navegador (encoder y rasterizador de texto).

import {
  firmar,
  MENSAJES_ES,
  rasterizeStroke,
  type Bitmap,
  type EncodePng,
  type Firma,
  type MedidorTexto,
  type ModoFirma,
  type MotivoRechazo,
  type OpcionesFirma,
  type PuntoTrazo,
  type TextRasterizer,
  type Verificador,
} from "@firma-kit/core";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { createCanvasPngEncoder } from "./encoder.js";
import {
  cargarFuente,
  createCanvasTextMeasurer,
  createCanvasTextRasterizer,
} from "./rasterizer.js";

const ETIQUETAS: Record<ModoFirma, string> = {
  dibujar: "Dibujar",
  escribir: "Escribir",
  subir: "Subir imagen",
  foto: "Tomar foto",
};

const ORDEN: ModoFirma[] = ["dibujar", "escribir", "subir", "foto"];

/** Lienzo de trabajo de dibujar y escribir, en píxeles CSS. */
const LIENZO = { width: 600, height: 200 };

export type FirmaFieldProps = {
  /** Modos ofrecidos, en orden. Por defecto los cuatro. */
  modos?: ModoFirma[];
  /** Pestaña inicial. Por defecto, el primer modo disponible. */
  modoInicial?: ModoFirma;
  /** Nombre a escribir. Sin nombre, el modo `escribir` no se ofrece. */
  nombre?: string;
  /** Firma ya elegida por el padre (modo controlado). */
  value?: Firma | null;
  onFirma?: (firma: Firma | null) => void;
  onRechazo?: (motivo: MotivoRechazo, mensaje: string) => void;
  verificador?: Verificador;
  anchoMaximo?: number;
  idioma?: "es";
  etiqueta?: string;
  className?: string;
  /** Puertos inyectables: pruebas sin canvas real. */
  encoder?: EncodePng;
  medidor?: MedidorTexto;
  rasterizer?: TextRasterizer;
};

export type FirmaFieldHandle = {
  limpiar: () => void;
  confirmar: () => void;
  abrirModo: (modo: ModoFirma) => void;
};

/**
 * Qué modos se pueden ofrecer de verdad: `escribir` necesita un nombre y `foto`
 * necesita cámara. Ocultar un modo imposible es mejor que un botón que falla.
 */
export function modosDisponibles(opciones: {
  // `| undefined` explícito: quien llama pasa props opcionales tal cual, y con
  // `exactOptionalPropertyTypes` eso no es lo mismo que una clave ausente.
  modos?: ModoFirma[] | undefined;
  nombre?: string | undefined;
  conCamara: boolean;
}): ModoFirma[] {
  const pedidos = opciones.modos?.length ? opciones.modos : ORDEN;
  const conNombre = Boolean(opciones.nombre?.trim());
  return pedidos.filter((modo) => {
    if (modo === "escribir") return conNombre;
    if (modo === "foto") return opciones.conCamara;
    return true;
  });
}

function tieneCamara(): boolean {
  return Boolean(
    (globalThis as { navigator?: Navigator }).navigator?.mediaDevices
  );
}

/** Decodifica un archivo del usuario a RGBA. Sin canvas, no hay firma. */
async function leerBitmap(archivo: File): Promise<Bitmap> {
  const bitmap = await createImageBitmap(archivo);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin contexto 2D");
  ctx.drawImage(bitmap, 0, 0);
  const datos = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { data: datos.data, width: bitmap.width, height: bitmap.height };
}

export const FirmaField = forwardRef<FirmaFieldHandle, FirmaFieldProps>(
  function FirmaField(props, ref) {
    const {
      modos,
      modoInicial,
      nombre,
      value,
      onFirma,
      onRechazo,
      verificador,
      anchoMaximo = 900,
      etiqueta = "Firma",
      className,
      encoder,
      medidor,
      rasterizer,
    } = props;

    const disponibles = useMemo(
      () => modosDisponibles({ modos, nombre, conCamara: tieneCamara() }),
      [modos, nombre]
    );
    const [modo, setModo] = useState<ModoFirma>(() => {
      const inicial = modoInicial ?? disponibles[0] ?? "dibujar";
      return disponibles.includes(inicial) ? inicial : (disponibles[0] ?? "dibujar");
    });
    const [puntos, setPuntos] = useState<PuntoTrazo[]>([]);
    const [archivo, setArchivo] = useState<File | null>(null);
    const [firma, setFirma] = useState<Firma | null>(value ?? null);
    const [error, setError] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const dibujando = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({});
    const baseId = useId();

    const encoderEfectivo = useMemo(
      () => encoder ?? createCanvasPngEncoder(),
      [encoder]
    );
    const medidorEfectivo = useMemo(
      () => medidor ?? createCanvasTextMeasurer(),
      [medidor]
    );
    const rasterizerEfectivo = useMemo(
      () => rasterizer ?? createCanvasTextRasterizer(),
      [rasterizer]
    );

    const firmaVisible = value !== undefined ? value : firma;

    // `exactOptionalPropertyTypes`: la clave `verificador` solo aparece cuando
    // hay un verificador de verdad, así que "no verificar" tiene una única
    // representación.
    const opcionesCore = useMemo<OpcionesFirma>(() => {
      const base: OpcionesFirma = { anchoMaximo };
      return verificador ? { ...base, verificador } : base;
    }, [anchoMaximo, verificador]);

    // El lienzo de dibujar se pinta con el mismo rasterizador puro que usa el
    // core: lo que se ve es exactamente lo que se va a guardar.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const bitmap = rasterizeStroke(puntos, LIENZO);
      const imagen = ctx.createImageData(bitmap.width, bitmap.height);
      imagen.data.set(bitmap.data);
      ctx.putImageData(imagen, 0, 0);
    }, [puntos, modo]);

    const limpiar = useCallback(() => {
      setPuntos([]);
      setArchivo(null);
      setError(null);
      if (value === undefined) {
        setFirma(null);
        onFirma?.(null);
      }
    }, [onFirma, value]);

    const confirmar = useCallback(async () => {
      setError(null);
      setOcupado(true);
      try {
        let resultado;
        if (modo === "dibujar") {
          resultado = await firmar(
            { modo: "dibujar", puntos, lienzo: LIENZO },
            encoderEfectivo,
            opcionesCore
          );
        } else if (modo === "escribir") {
          await cargarFuente("Caveat", 72);
          resultado = await firmar(
            {
              modo: "escribir",
              texto: (nombre ?? "").trim(),
              lienzo: LIENZO,
              medidor: medidorEfectivo,
              rasterizer: rasterizerEfectivo,
            },
            encoderEfectivo,
            opcionesCore
          );
        } else {
          if (!archivo) {
            setError("Elige una imagen antes de continuar.");
            return;
          }
          const imagen = await leerBitmap(archivo).catch(() => null);
          if (!imagen) {
            setError(MENSAJES_ES.ilegible);
            onRechazo?.("ilegible", MENSAJES_ES.ilegible);
            return;
          }
          resultado = await firmar(
            { modo: modo === "foto" ? "foto" : "subir", imagen },
            encoderEfectivo,
            opcionesCore
          );
        }

        if (resultado.ok) {
          if (value === undefined) setFirma(resultado.firma);
          onFirma?.(resultado.firma);
        } else {
          setError(resultado.mensaje);
          onRechazo?.(resultado.motivo, resultado.mensaje);
        }
      } catch {
        // Un fallo del navegador (canvas bloqueado) no puede dejar el botón
        // girando para siempre.
        setError(MENSAJES_ES.ilegible);
        onRechazo?.("ilegible", MENSAJES_ES.ilegible);
      } finally {
        setOcupado(false);
      }
    }, [
      archivo,
      encoderEfectivo,
      medidorEfectivo,
      modo,
      nombre,
      onFirma,
      onRechazo,
      opcionesCore,
      puntos,
      rasterizerEfectivo,
      value,
    ]);

    useImperativeHandle(
      ref,
      () => ({ limpiar, confirmar: () => void confirmar(), abrirModo: setModo }),
      [limpiar, confirmar]
    );

    const alPulsarTecla = useCallback(
      (evento: React.KeyboardEvent<HTMLButtonElement>, actual: ModoFirma) => {
        const indice = disponibles.indexOf(actual);
        let destino: number | null = null;
        if (evento.key === "ArrowRight") destino = (indice + 1) % disponibles.length;
        else if (evento.key === "ArrowLeft")
          destino = (indice - 1 + disponibles.length) % disponibles.length;
        else if (evento.key === "Home") destino = 0;
        else if (evento.key === "End") destino = disponibles.length - 1;
        if (destino === null) return;
        evento.preventDefault();
        const siguiente = disponibles[destino];
        if (!siguiente) return;
        setModo(siguiente);
        tabsRef.current[siguiente]?.focus();
      },
      [disponibles]
    );

    const punto = useCallback(
      (evento: React.PointerEvent<HTMLCanvasElement>): PuntoTrazo | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const caja = canvas.getBoundingClientRect();
        if (caja.width === 0 || caja.height === 0) return null;
        return {
          x: ((evento.clientX - caja.left) * LIENZO.width) / caja.width,
          y: ((evento.clientY - caja.top) * LIENZO.height) / caja.height,
          t: evento.timeStamp,
        };
      },
      []
    );

    return (
      <div className={className ? `firma ${className}` : "firma"}>
        <div className="firma__tabs" role="tablist" aria-label={etiqueta}>
          {disponibles.map((disponible) => {
            const activo = disponible === modo;
            return (
              <button
                key={disponible}
                ref={(el) => {
                  tabsRef.current[disponible] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${disponible}`}
                aria-selected={activo}
                aria-controls={`${baseId}-panel`}
                tabIndex={activo ? 0 : -1}
                className={activo ? "firma__tab firma__tab--activa" : "firma__tab"}
                onClick={() => setModo(disponible)}
                onKeyDown={(evento) => alPulsarTecla(evento, disponible)}
              >
                {ETIQUETAS[disponible]}
              </button>
            );
          })}
        </div>

        <div
          className="firma__panel"
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${modo}`}
        >
          {modo === "dibujar" ? (
            <canvas
              ref={canvasRef}
              className="firma__lienzo"
              width={LIENZO.width}
              height={LIENZO.height}
              aria-label="Zona para dibujar la firma con el dedo o el puntero"
              onPointerDown={(evento) => {
                dibujando.current = true;
                evento.currentTarget.setPointerCapture(evento.pointerId);
                const p = punto(evento);
                if (p) setPuntos((previos) => [...previos, p]);
              }}
              onPointerMove={(evento) => {
                if (!dibujando.current) return;
                const p = punto(evento);
                if (p) setPuntos((previos) => [...previos, p]);
              }}
              onPointerUp={() => {
                dibujando.current = false;
              }}
              onPointerCancel={() => {
                dibujando.current = false;
              }}
            />
          ) : null}

          {modo === "escribir" ? (
            <p className="firma__vista-previa" aria-live="polite">
              {nombre?.trim()
                ? `Tu nombre se escribirá en cursiva: ${nombre.trim()}`
                : "Escribe tu nombre para verlo en cursiva."}
            </p>
          ) : null}

          {modo === "subir" || modo === "foto" ? (
            <label className="firma__archivo">
              <span>
                {modo === "foto" ? "Tomar foto de la firma" : "Subir imagen de la firma"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                {...(modo === "foto" ? { capture: "environment" as const } : {})}
                onChange={(evento) => {
                  setArchivo(evento.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </label>
          ) : null}

          <div className="firma__acciones">
            <button type="button" className="firma__boton" onClick={limpiar}>
              Limpiar
            </button>
            <button
              type="button"
              className="firma__boton firma__boton--principal"
              onClick={() => void confirmar()}
              disabled={ocupado}
            >
              {ocupado ? "Procesando…" : "Usar esta firma"}
            </button>
          </div>

          {error ? (
            <p className="firma__error" role="alert">
              {error}
            </p>
          ) : null}

          <p className="firma__estado" aria-live="polite">
            {firmaVisible ? "Firma lista para guardar." : ""}
          </p>
        </div>
      </div>
    );
  }
);
