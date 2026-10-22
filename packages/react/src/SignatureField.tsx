"use client";

// <FirmaField />: las cuatro formas de firmar en un componente controlable y
// accesible. La lógica de firma vive en `@firma-kit/core`; aquí solo está el
// DOM, el estado y los puertos de navegador (encoder y rasterizador de texto).

import {
  rejectionMessage,
  sign,
  rasterizeStroke,
  type Bitmap,
  type PngEncoder,
  type Signature,
  type TextMeasurer,
  type Locale,
  type SignatureMode,
  type RejectionReason,
  type SignatureOptions,
  type StrokePoint,
  type TextRasterizer,
  type Verifier,
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
  loadFont,
  createCanvasTextMeasurer,
  createCanvasTextRasterizer,
} from "./rasterizer.js";

// Etiquetas de pestaña en los dos idiomas: el inglés es el primario, el español
// es el que ve hoy la persona que firma en los proyectos de origen.
const TAB_LABELS: Record<Locale, Record<SignatureMode, string>> = {
  en: { draw: "Draw", type: "Type", upload: "Upload", camera: "Camera" },
  es: { draw: "Dibujar", type: "Escribir", upload: "Subir imagen", camera: "Tomar foto" },
};

const FIELD_TEXT: Record<Locale, Record<string, string>> = {
  en: {
    canvas: "Area to draw the signature with a finger or pointer",
    typeHint: "Your name will be written in cursive",
    typeEmpty: "Type your name to see it in cursive",
    chooseFile: "Choose an image before continuing",
    upload: "Upload an image of the signature",
    camera: "Take a photo of the signature",
    clear: "Clear",
    confirm: "Use this signature",
    busy: "Working…",
    ready: "Signature ready to save.",
  },
  es: {
    canvas: "Zona para dibujar la firma con el dedo o el puntero",
    typeHint: "Tu nombre se escribirá en cursiva",
    typeEmpty: "Escribe tu nombre para verlo en cursiva",
    chooseFile: "Elige una imagen antes de continuar",
    upload: "Subir imagen de la firma",
    camera: "Tomar foto de la firma",
    clear: "Limpiar",
    confirm: "Usar esta firma",
    busy: "Procesando…",
    ready: "Firma lista para guardar.",
  },
};

const MODE_ORDER: SignatureMode[] = ["draw", "type", "upload", "camera"];

/** Lienzo de trabajo de dibujar y escribir, en píxeles CSS. */
const CANVAS_SIZE = { width: 600, height: 200 };

export type SignatureFieldProps = {
  /** Modos ofrecidos, en orden. Por defecto los cuatro. */
  modes?: SignatureMode[];
  /** Pestaña inicial. Por defecto, el primer mode availableMode. */
  initialMode?: SignatureMode;
  /** Nombre a escribir. Sin name, el mode `escribir` no se ofrece. */
  name?: string;
  /** Signature ya elegida por el padre (mode controlado). */
  value?: Signature | null;
  onSignature?: (signature: Signature | null) => void;
  onRejection?: (reason: RejectionReason, message: string) => void;
  verifier?: Verifier;
  maxWidth?: number;
  locale?: Locale;
  label?: string;
  className?: string;
  /** Puertos inyectables: pruebas sin canvas real. */
  encoder?: PngEncoder;
  measurer?: TextMeasurer;
  rasterizer?: TextRasterizer;
};

export type SignatureFieldHandle = {
  clear: () => void;
  confirm: () => void;
  openMode: (mode: SignatureMode) => void;
};

/**
 * Qué modes se pueden ofrecer de verdad: `escribir` necesita un name y `foto`
 * necesita cámara. Ocultar un mode imposible es mejor que un botón que falla.
 */
export function availableModes(options: {
  // `| undefined` explícito: quien llama pasa props opcionales tal cual, y con
  // `exactOptionalPropertyTypes` eso no es lo mismo que una clave ausente.
  modes?: SignatureMode[] | undefined;
  name?: string | undefined;
  hasCamera: boolean;
}): SignatureMode[] {
  const requested = options.modes?.length ? options.modes : MODE_ORDER;
  const withName = Boolean(options.name?.trim());
  return requested.filter((mode) => {
    if (mode === "type") return withName;
    if (mode === "camera") return options.hasCamera;
    return true;
  });
}

function hasCameraSupport(): boolean {
  return Boolean(
    (globalThis as { navigator?: Navigator }).navigator?.mediaDevices
  );
}

/** Decodifica un file del usuario a RGBA. Sin canvas, no hay signature. */
async function readBitmap(file: File): Promise<Bitmap> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin contexto 2D");
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { data: data.data, width: bitmap.width, height: bitmap.height };
}

export const SignatureField = forwardRef<SignatureFieldHandle, SignatureFieldProps>(
  function SignatureField(props, ref) {
    const {
      modes,
      initialMode,
      name,
      value,
      onSignature,
      onRejection,
      verifier,
      maxWidth = 900,
      label,
      locale = "en",
      className,
      encoder,
      measurer,
      rasterizer,
    } = props;

    const available = useMemo(
      () => availableModes({ modes, name, hasCamera: hasCameraSupport() }),
      [modes, name]
    );
    const [mode, setMode] = useState<SignatureMode>(() => {
      const initial = initialMode ?? available[0] ?? "draw";
      return available.includes(initial) ? initial : (available[0] ?? "draw");
    });
    const [points, setPoints] = useState<StrokePoint[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [signature, setSignature] = useState<Signature | null>(value ?? null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setOcupado] = useState(false);

    const drawing = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const tabsRef = useRef<Record<string, HTMLButtonElement | null>>({});
    const baseId = useId();

    const effectiveEncoder = useMemo(
      () => encoder ?? createCanvasPngEncoder(),
      [encoder]
    );
    const effectiveMeasurer = useMemo(
      () => measurer ?? createCanvasTextMeasurer(),
      [measurer]
    );
    const effectiveRasterizer = useMemo(
      () => rasterizer ?? createCanvasTextRasterizer(),
      [rasterizer]
    );

    const texts = FIELD_TEXT[locale] ?? FIELD_TEXT.en;
    const tabLabels = TAB_LABELS[locale] ?? TAB_LABELS.en;
    const visibleSignature = value !== undefined ? value : signature;

    // `exactOptionalPropertyTypes`: la clave `verificador` solo aparece cuando
    // hay un verificador de verdad, así que "no verificar" tiene una única
    // representación.
    const coreOptions = useMemo<SignatureOptions>(() => {
      const base: SignatureOptions = { maxWidth };
      return verifier ? { ...base, verifier } : base;
    }, [maxWidth, verifier]);

    // El lienzo de dibujar se pinta con el mismo rasterizador puro que usa el
    // core: lo que se ve es exactamente lo que se va a guardar.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const bitmap = rasterizeStroke(points, CANVAS_SIZE);
      const image = ctx.createImageData(bitmap.width, bitmap.height);
      image.data.set(bitmap.data);
      ctx.putImageData(image, 0, 0);
    }, [points, mode]);

    const clear = useCallback(() => {
      setPoints([]);
      setFile(null);
      setError(null);
      if (value === undefined) {
        setSignature(null);
        onSignature?.(null);
      }
    }, [onSignature, value]);

    const confirm = useCallback(async () => {
      setError(null);
      setOcupado(true);
      try {
        let result;
        if (mode === "draw") {
          result = await sign(
            { mode: "draw", points, canvas: CANVAS_SIZE },
            effectiveEncoder,
            coreOptions
          );
        } else if (mode === "type") {
          await loadFont("Caveat", 72);
          result = await sign(
            {
              mode: "type",
              text: (name ?? "").trim(),
              canvas: CANVAS_SIZE,
              measurer: effectiveMeasurer,
              rasterizer: effectiveRasterizer,
            },
            effectiveEncoder,
            coreOptions
          );
        } else {
          if (!file) {
            setError(texts.chooseFile!);
            return;
          }
          const image = await readBitmap(file).catch(() => null);
          if (!image) {
            setError(rejectionMessage("unreadable", locale));
            onRejection?.("unreadable", rejectionMessage("unreadable", locale));
            return;
          }
          result = await sign(
            { mode: mode === "camera" ? "camera" : "upload", image },
            effectiveEncoder,
            coreOptions
          );
        }

        if (result.ok) {
          if (value === undefined) setSignature(result.signature);
          onSignature?.(result.signature);
        } else {
          setError(result.message);
          onRejection?.(result.reason, result.message);
        }
      } catch {
        // Un fallo del navegador (canvas bloqueado) no puede dejar el botón
        // girando para siempre.
        setError(rejectionMessage("unreadable", locale));
        onRejection?.("unreadable", rejectionMessage("unreadable", locale));
      } finally {
        setOcupado(false);
      }
    }, [
      file,
      effectiveEncoder,
      effectiveMeasurer,
      mode,
      name,
      onSignature,
      onRejection,
      coreOptions,
      points,
      effectiveRasterizer,
      value,
    ]);

    useImperativeHandle(
      ref,
      () => ({ clear, confirm: () => void confirm(), openMode: setMode }),
      [clear, confirm]
    );

    const onKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLButtonElement>, current: SignatureMode) => {
        const indice = available.indexOf(current);
        let destino: number | null = null;
        if (event.key === "ArrowRight") destino = (indice + 1) % available.length;
        else if (event.key === "ArrowLeft")
          destino = (indice - 1 + available.length) % available.length;
        else if (event.key === "Home") destino = 0;
        else if (event.key === "End") destino = available.length - 1;
        if (destino === null) return;
        event.preventDefault();
        const next = available[destino];
        if (!next) return;
        setMode(next);
        tabsRef.current[next]?.focus();
      },
      [available]
    );

    const point = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>): StrokePoint | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const bounds = canvas.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) return null;
        return {
          x: ((event.clientX - bounds.left) * CANVAS_SIZE.width) / bounds.width,
          y: ((event.clientY - bounds.top) * CANVAS_SIZE.height) / bounds.height,
          t: event.timeStamp,
        };
      },
      []
    );

    return (
      <div className={className ? `signature ${className}` : "signature"}>
        <div className="signature__tabs" role="tablist" aria-label={label ?? (locale === "es" ? "Firma" : "Signature")}>
          {available.map((availableMode) => {
            const active = availableMode === mode;
            return (
              <button
                key={availableMode}
                ref={(el) => {
                  tabsRef.current[availableMode] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${availableMode}`}
                aria-selected={active}
                aria-controls={`${baseId}-panel`}
                tabIndex={active ? 0 : -1}
                className={active ? "signature__tab signature__tab--active" : "signature__tab"}
                onClick={() => setMode(availableMode)}
                onKeyDown={(event) => onKeyDown(event, availableMode)}
              >
                {tabLabels[availableMode]}
              </button>
            );
          })}
        </div>

        <div
          className="signature__panel"
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${mode}`}
        >
          {mode === "draw" ? (
            <canvas
              ref={canvasRef}
              className="signature__lienzo"
              width={CANVAS_SIZE.width}
              height={CANVAS_SIZE.height}
              aria-label={texts.canvas}
              onPointerDown={(event) => {
                drawing.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                const p = point(event);
                if (p) setPoints((previos) => [...previos, p]);
              }}
              onPointerMove={(event) => {
                if (!drawing.current) return;
                const p = point(event);
                if (p) setPoints((previos) => [...previos, p]);
              }}
              onPointerUp={() => {
                drawing.current = false;
              }}
              onPointerCancel={() => {
                drawing.current = false;
              }}
            />
          ) : null}

          {mode === "type" ? (
            <p className="signature__vista-previa" aria-live="polite">
              {name?.trim()
                ? `${texts.typeHint}: ${name.trim()}`
                : texts.typeEmpty}
            </p>
          ) : null}

          {mode === "upload" || mode === "camera" ? (
            <label className="signature__archivo">
              <span>
                {mode === "camera" ? texts.camera : texts.upload}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                {...(mode === "camera" ? { capture: "environment" as const } : {})}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </label>
          ) : null}

          <div className="signature__acciones">
            <button type="button" className="signature__button" onClick={clear}>
              {texts.clear}
            </button>
            <button
              type="button"
              className="signature__button signature__button--principal"
              onClick={() => void confirm()}
              disabled={busy}
            >
              {busy ? texts.busy : texts.confirm}
            </button>
          </div>

          {error ? (
            <p className="signature__error" role="alert">
              {error}
            </p>
          ) : null}

          <p className="signature__estado" aria-live="polite">
            {visibleSignature ? texts.ready : ""}
          </p>
        </div>
      </div>
    );
  }
);
