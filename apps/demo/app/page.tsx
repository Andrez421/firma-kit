"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Bitmap, Signature, Verdict, Verifier } from "@firma-kit/core";
import { SignatureField, toPngBlob, type SignatureFieldHandle } from "@firma-kit/react";

import { Controls } from "./components/Controls.js";
import { RejectionDialog } from "./components/RejectionDialog.js";
import {
  DEFAULT_CONFIG,
  decodeConfig,
  encodeConfig,
  normalizar,
  propsFor,
  type DemoConfig,
} from "../lib/config.js";
import { PAGE_COPY } from "../lib/copy.js";
import { presetById, type PageTheme } from "../lib/presets.js";

const GATE_URL = process.env.NEXT_PUBLIC_GATE_URL ?? "http://127.0.0.1:8790";
const GATE_TOKEN = process.env.NEXT_PUBLIC_GATE_TOKEN ?? "";
const GATE_TIMEOUT_MS = 8_000;

/** Los avisos del gate, en cualquiera de los dos idiomas. */
type NotasDelGate = (typeof PAGE_COPY)[keyof typeof PAGE_COPY]["gateNotes"];

/** Traduce el estado HTTP del gate a algo que se pueda accionar. */
function motivoDelFallo(estado: number, notas: NotasDelGate): string {
  if (estado === 401) return notas.unauthorized;
  if (estado === 403) return `${notas.origin} ${window.location.origin}`;
  if (estado === 413) return notas.tooLarge;
  if (estado === 429) return notas.rateLimited;
  return notas.unavailable;
}
const REPO_URL = "https://github.com/Andrez421/firma-kit";
const THEME_KEY = "firma-kit-demo-theme";

type FalloDelGate = Error & { reintentar?: boolean; esperaMs?: number };

async function pedirVeredicto(imagen: Bitmap, notas: NotasDelGate): Promise<Verdict> {
  const res = await fetch(`${GATE_URL}/verificar?w=${imagen.width}&h=${imagen.height}`, {
    method: "POST",
    body: new Uint8Array(imagen.data),
    ...(GATE_TOKEN ? { headers: { "x-gate-token": GATE_TOKEN } } : {}),
    signal: AbortSignal.timeout(GATE_TIMEOUT_MS),
  });
  if (!res.ok) {
    const fallo = new Error(motivoDelFallo(res.status, notas)) as FalloDelGate;
    fallo.reintentar = res.status === 503;
    const indicado = Number(res.headers.get("retry-after") ?? "1");
    fallo.esperaMs = Math.min(2_000, (Number.isFinite(indicado) ? indicado : 1) * 1_000);
    throw fallo;
  }
  return (await res.json()) as Verdict;
}

export default function Page() {
  const [config, setConfig] = useState<DemoConfig>(DEFAULT_CONFIG);
  const [pageTheme, setPageTheme] = useState<PageTheme>("light");
  const [signature, setSignature] = useState<Signature | null>(null);
  const [gate, setGate] = useState<"checking" | "on" | "off">("checking");
  const [gateNote, setGateNote] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  // Cuando el servicio no da veredicto no se puede decir «no es una firma»: se dice
  // que no se pudo comprobar, y por qué. Es la diferencia entre un rechazo y un fallo.
  const [gateFailure, setGateFailure] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"nada" | "props" | "enlace">("nada");
  const field = useRef<SignatureFieldHandle | null>(null);

  const copy = PAGE_COPY[config.locale];
  const preset = presetById(config.preset);
  const props = useMemo(() => propsFor(config, pageTheme), [config, pageTheme]);
  const propsJson = useMemo(() => JSON.stringify(props, null, 2), [props]);

  // Estado desde la URL y tema guardado: el enlace tiene que reproducir la vista.
  useEffect(() => {
    const parametro = new URLSearchParams(window.location.search).get("c");
    const desdeUrl = parametro ? decodeConfig(parametro) : null;
    if (desdeUrl) setConfig(desdeUrl);

    const guardado = window.localStorage.getItem(THEME_KEY);
    if (guardado === "light" || guardado === "dark") setPageTheme(guardado);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setPageTheme("dark");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = pageTheme;
  }, [pageTheme]);

  // La URL se reescribe sin recargar: compartir es copiar la barra de direcciones.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("c", encodeConfig(config));
    window.history.replaceState(null, "", url);
  }, [config]);

  useEffect(() => {
    let vigente = true;
    fetch(`${GATE_URL}/salud`, { signal: AbortSignal.timeout(2_000) })
      .then((res) => {
        if (vigente) setGate(res.ok ? "on" : "off");
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
          return await pedirVeredicto(imagen, copy.gateNotes);
        } catch (error) {
          const fallo = error as FalloDelGate;
          const deRed = fallo.reintentar === undefined;
          if (!deRed && fallo.reintentar !== true) {
            setGateNote(copy.gateFailedNote);
            setGateFailure(`${fallo.message} ${copy.gateNotes.acceptedWithout}`);
            throw error;
          }
          await new Promise((listo) =>
            setTimeout(listo, (fallo.esperaMs ?? 0) + 150 + Math.random() * 250)
          );
          try {
            return await pedirVeredicto(imagen, copy.gateNotes);
          } catch (segundo) {
            // Un fallo de red no trae mensaje traducido: es el `TypeError` del
            // navegador («Failed to fetch»), así que se cuenta como servicio caído.
            const esRed = (segundo as FalloDelGate).reintentar === undefined;
            const motivo =
              esRed || !(segundo instanceof Error)
                ? copy.gateNotes.unavailable
                : segundo.message;
            setGateNote(copy.gateFailedNote);
            setGateFailure(`${motivo} ${copy.gateNotes.acceptedWithout}`);
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

  const copiar = useCallback(async (texto: string, cual: "props" | "enlace") => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado("nada"), 1_600);
    } catch {
      // Sin permiso de portapapeles se queda el texto seleccionable, que sigue sirviendo.
    }
  }, []);

  const limpiar = useCallback(() => {
    field.current?.clear();
    setSignature(null);
    setRejection(null);
    setGateNote(null);
  }, []);

  const reiniciar = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    limpiar();
  }, [limpiar]);

  const cambiarTema = (siguiente: PageTheme) => {
    setPageTheme(siguiente);
    window.localStorage.setItem(THEME_KEY, siguiente);
  };

  // Cambiar los modos disponibles o el inicial re-crea el campo: es la única forma de
  // que las pestañas reflejen la configuración sin dejar un trazo a medias.
  const claveCampo = `${config.modes.join("-")}|${config.initialMode}`;

  return (
    <main className={rejection || gateFailure ? "demo-modal-open" : undefined}>
      <header className="demo-header">
        <div>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>
        <div className="header-actions">
          <span className="pill" data-state={gate === "on" ? "on" : "off"}>
            {gate === "checking"
              ? copy.gateChecking
              : gate === "on"
                ? copy.gateOn
                : copy.gateOff}
          </span>
          <a className="ghost-button" href={REPO_URL} target="_blank" rel="noreferrer">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            {copy.github}
          </a>
          <div className="segmented" role="group" aria-label={copy.themeLight}>
            <button
              type="button"
              aria-pressed={pageTheme === "light"}
              onClick={() => cambiarTema("light")}
            >
              {copy.themeLight}
            </button>
            <button
              type="button"
              aria-pressed={pageTheme === "dark"}
              onClick={() => cambiarTema("dark")}
            >
              {copy.themeDark}
            </button>
          </div>
        </div>
      </header>

      {rejection || gateFailure ? (
        <RejectionDialog
          title={rejection ? copy.rejectionTitle : copy.failedTitle}
          message={rejection ?? gateFailure ?? ""}
          close={copy.rejectionClose}
          onClose={() => {
            setRejection(null);
            setGateFailure(null);
          }}
        />
      ) : null}

      <div className="layout">
        <div className="column">
          <SignatureField
            key={claveCampo}
            ref={field}
            {...props}
            className={preset.className}
            style={preset.vars as React.CSSProperties}
            {...(gate === "on" ? { verifier } : {})}
            onFontChange={(fuente) => setConfig((actual) => ({ ...actual, font: fuente }))}
            onSignature={(next) => {
              setSignature(next);
              setRejection(null);
            }}
            onRejection={(_motivo, mensaje) => {
              setSignature(null);
              setRejection(mensaje);
            }}
          />

          <p className="sheet-note">
            {config.locale === "es"
              ? "La hoja se queda blanca a propósito: la firma guardada es siempre tinta sobre blanco, sea cual sea el tema."
              : "The sheet stays white on purpose: the saved signature is always ink on white, whatever the theme."}
          </p>

          {gate === "off" ? <p className="note">{copy.gateOffNote}</p> : null}
          {gate === "on" && gateNote ? <p className="note">{gateNote}</p> : null}

          <h2>{copy.result}</h2>
          {signature && previewUrl ? (
            <div className="result">
              {/* eslint-disable-next-line @next/next/no-img-element -- object URL local, no remoto */}
              <img
                src={previewUrl}
                alt={copy.result}
                width={signature.width}
                height={signature.height}
              />
              <div>
                <dl>
                  <dt>{copy.mode}</dt>
                  <dd>{signature.mode}</dd>
                  <dt>{copy.dimensions}</dt>
                  <dd>
                    {signature.width} × {signature.height}
                  </dd>
                  <dt>{copy.bytes}</dt>
                  <dd>{signature.png.byteLength.toLocaleString(config.locale)}</dd>
                  <dt>{copy.created}</dt>
                  <dd>{new Date(signature.createdAt).toLocaleString(config.locale)}</dd>
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
        </div>

        <div className="column panel-column">
          <Controls
            config={config}
            activePreset={preset}
            onChange={(siguiente) => setConfig(normalizar(siguiente))}
            onPreset={(id) => setConfig((actual) => ({ ...actual, preset: id }))}
          />

          <section>
            <h2>{copy.code}</h2>
            <pre className="props">
              <code>{propsJson}</code>
            </pre>
            <div className="row">
              <button
                type="button"
                className="demo-button"
                onClick={() => void copiar(propsJson, "props")}
              >
                {copiado === "props" ? copy.copied : copy.copyCode}
              </button>
              <button
                type="button"
                className="demo-button"
                onClick={() =>
                  void copiar(
                    `${window.location.origin}${window.location.pathname}?c=${encodeConfig(config)}`,
                    "enlace"
                  )
                }
              >
                {copiado === "enlace" ? copy.copied : copy.share}
              </button>
              <button type="button" className="demo-button" onClick={reiniciar}>
                {copy.reset}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
