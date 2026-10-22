"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Bitmap, Locale, Signature, Verdict, Verifier } from "@firma-kit/core";
import { SignatureField, toPngBlob, type SignatureFieldHandle } from "@firma-kit/react";

// El gate vive fuera del navegador (201 MB de ONNX no caben en una visita). Se
// configura por entorno para que el demo funcione tanto en local como por tailnet.
const GATE_URL = process.env.NEXT_PUBLIC_GATE_URL ?? "http://127.0.0.1:8790";
const GATE_TOKEN = process.env.NEXT_PUBLIC_GATE_TOKEN ?? "";
const GATE_TIMEOUT_MS = 8_000;

type FalloDelGate = Error & { reintentar?: boolean; esperaMs?: number };

async function pedirVeredicto(imagen: Bitmap): Promise<Verdict> {
  const res = await fetch(`${GATE_URL}/verificar?w=${imagen.width}&h=${imagen.height}`, {
    method: "POST",
    body: new Uint8Array(imagen.data),
    ...(GATE_TOKEN ? { headers: { "x-gate-token": GATE_TOKEN } } : {}),
    signal: AbortSignal.timeout(GATE_TIMEOUT_MS),
  });
  if (!res.ok) {
    const fallo = new Error(`gate ${res.status}`) as FalloDelGate;
    fallo.reintentar = res.status === 503;
    const indicado = Number(res.headers.get("retry-after") ?? "1");
    fallo.esperaMs = Math.min(2_000, (Number.isFinite(indicado) ? indicado : 1) * 1_000);
    throw fallo;
  }
  return (await res.json()) as Verdict;
}

const COPY = {
  en: {
    title: "firma-kit",
    lede: "Four ways to sign, one PNG out, and a visual check that refuses what is not a signature.",
    language: "Language",
    size: "Size",
    clear: "Clear",
    gateChecking: "checking verification…",
    gateOn: "verification connected",
    gateOff: "verification off",
    gateOffNote:
      "The visual check is not running, so this page is not verifying anything. The field still works: verification is a safeguard, never a requirement to sign.",
    gateFailedNote: "The visual check failed for this image. You can still sign.",
    result: "Result",
    empty: "Nothing signed yet.",
    mode: "Mode",
    dimensions: "Size",
    bytes: "Bytes",
    created: "Created",
    download: "Download PNG",
    integration: "How to integrate this in your project →",
  },
  es: {
    title: "firma-kit",
    lede: "Cuatro formas de firmar, un PNG de salida y una comprobación visual que rechaza lo que no es una firma.",
    language: "Idioma",
    size: "Tamaño",
    clear: "Limpiar",
    gateChecking: "comprobando la verificación…",
    gateOn: "verificación conectada",
    gateOff: "verificación apagada",
    gateOffNote:
      "La comprobación visual no está funcionando, así que esta página no está verificando nada. El campo sigue funcionando: la verificación es una salvaguarda, nunca un requisito para firmar.",
    gateFailedNote: "La comprobación visual falló con esta imagen. Puedes firmar igual.",
    result: "Resultado",
    empty: "Todavía no has firmado nada.",
    mode: "Modo",
    dimensions: "Medidas",
    bytes: "Bytes",
    created: "Creada",
    download: "Descargar PNG",
    integration: "Cómo integrar esto en tu proyecto →",
  },
} as const;

export default function Page() {
  const [locale, setLocale] = useState<Locale>("en");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [signature, setSignature] = useState<Signature | null>(null);
  const [gate, setGate] = useState<"checking" | "on" | "off">("checking");
  const [gateNote, setGateNote] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const field = useRef<SignatureFieldHandle | null>(null);

  const copy = COPY[locale];

  // Sonda de salud: sin servicio, el demo lo dice en vez de fingir que verificó.
  useEffect(() => {
    let vigente = true;
    fetch(`${GATE_URL}/salud`, { signal: AbortSignal.timeout(2_000) })
      .then((res) => {
        if (!vigente) return;
        setGate(res.ok ? "on" : "off");
      })
      .catch(() => {
        if (vigente) setGate("off");
      });
    return () => {
      vigente = false;
    };
  }, []);

  const verifier = useMemo<Verifier>(
    () => ({
      verify: async (imagen: Bitmap): Promise<Verdict> => {
        try {
          return await pedirVeredicto(imagen);
        } catch (error) {
          const fallo = error as FalloDelGate;
          // Un fallo de red o un 503 se reintentan una vez; un 401, 403, 413 o 429
          // no, porque insistir no arregla ni el token ni el tamaño.
          const deRed = fallo.reintentar === undefined;
          if (!deRed && fallo.reintentar !== true) {
            setGateNote(copy.gateFailedNote);
            throw error;
          }
          await new Promise((listo) =>
            setTimeout(listo, (fallo.esperaMs ?? 0) + 150 + Math.random() * 250)
          );
          try {
            return await pedirVeredicto(imagen);
          } catch (segundo) {
            setGateNote(copy.gateFailedNote);
            throw segundo;
          }
        }
      },
    }),
    [copy.gateFailedNote]
  );

  const previewUrl = useMemo(
    () => (signature ? URL.createObjectURL(toPngBlob(signature)) : null),
    [signature]
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const clear = useCallback(() => {
    field.current?.clear();
    setSignature(null);
    setRejection(null);
    setGateNote(null);
  }, []);

  return (
    <main>
      <header className="demo-header">
        <div>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>
        <span className="pill" data-state={gate === "on" ? "on" : "off"}>
          {gate === "checking"
            ? copy.gateChecking
            : gate === "on"
              ? copy.gateOn
              : copy.gateOff}
        </span>
      </header>

      <section className="controls" aria-label={copy.language}>
        <label>
          {copy.language}
          <select
            value={locale}
            onChange={(evento) => setLocale(evento.target.value as Locale)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        <label>
          {copy.size}
          <select
            value={size}
            onChange={(evento) => setSize(evento.target.value as "sm" | "md" | "lg")}
          >
            <option value="sm">S</option>
            <option value="md">M</option>
            <option value="lg">L</option>
          </select>
        </label>
        <button type="button" className="demo-button" onClick={clear}>
          {copy.clear}
        </button>
      </section>

      <SignatureField
        ref={field}
        locale={locale}
        size={size}
        name={locale === "es" ? "Nombre y apellidos" : "Full name"}
        {...(gate === "on" ? { verifier } : {})}
        onSignature={(next) => {
          setSignature(next);
          setRejection(null);
        }}
        onRejection={(_motivo, mensaje) => {
          setSignature(null);
          setRejection(mensaje);
        }}
      />

      {rejection ? <p className="note">{rejection}</p> : null}
      {gate === "off" ? <p className="note">{copy.gateOffNote}</p> : null}
      {gate === "on" && gateNote ? <p className="note">{gateNote}</p> : null}

      <h2>{copy.result}</h2>
      {signature && previewUrl ? (
        <div className="result">
          {/* eslint-disable-next-line @next/next/no-img-element -- es un object URL local, no una imagen remota */}
          <img src={previewUrl} alt={copy.result} width={signature.width} height={signature.height} />
          <div>
            <dl>
              <dt>{copy.mode}</dt>
              <dd>{signature.mode}</dd>
              <dt>{copy.dimensions}</dt>
              <dd>
                {signature.width} × {signature.height}
              </dd>
              <dt>{copy.bytes}</dt>
              <dd>{signature.png.byteLength.toLocaleString(locale)}</dd>
              <dt>{copy.created}</dt>
              <dd>{new Date(signature.createdAt).toLocaleString(locale)}</dd>
            </dl>
            <p>
              <a href={previewUrl} download={`firma-${signature.mode}.png`}>
                {copy.download}
              </a>
            </p>
          </div>
        </div>
      ) : (
        <p className="empty">{copy.empty}</p>
      )}

      <p>
        <a href="/integration">{copy.integration}</a>
      </p>
    </main>
  );
}
