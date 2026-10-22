// Estado del demo: un objeto plano que se puede codificar en la URL, mostrar como
// props y volver a cargar. Todo lo que hay aquí se consigue con props y variables CSS
// que el componente ya expone; nada de esto toca el contrato.
import type { Locale, SignatureMode, TypeFont } from "@firma-kit/core";
import type { ToolbarAction } from "@firma-kit/react";

import type { PageTheme } from "./presets.js";

export const ALL_MODES: SignatureMode[] = ["draw", "type", "upload", "camera"];
export const ALL_ACTIONS: ToolbarAction[] = [
  "undo",
  "redo",
  "erase",
  "fullscreen",
  "clear",
  "confirm",
];
export const FONTS: TypeFont[] = ["Caveat", "Pacifico", "Great Vibes", "Sacramento"];

export type DemoConfig = {
  preset: string;
  locale: Locale;
  size: "sm" | "md" | "lg";
  /** "auto" sigue el tema de la página: el campo no tiene por qué coincidir. */
  fieldTheme: "auto" | "light" | "dark";
  modes: SignatureMode[];
  initialMode: SignatureMode;
  maxLines: 1 | 2;
  font: TypeFont;
  maxBytesKb: number;
  name: string;
  /** Acciones de la barra, en orden. Vacío = sin barra. */
  toolbar: ToolbarAction[];
  /** Une cada trazo al último punto del anterior. */
  strokeLink: boolean;
  stroke: {
    minWidth: number;
    maxWidth: number;
    smoothing: number;
    ink: number;
    maxSpeed: number;
  };
};

export const DEFAULT_CONFIG: DemoConfig = {
  preset: "impresion",
  locale: "en",
  size: "md",
  fieldTheme: "auto",
  modes: ALL_MODES,
  initialMode: "draw",
  // Una línea por defecto: es lo que pide casi todo el mundo y cabe sin apretar.
  maxLines: 1,
  font: "Caveat",
  maxBytesKb: 5120,
  // Con un nombre por defecto se ven los cuatro modos al abrir la página; borrarlo
  // enseña el comportamiento real del modo escribir sin nombre.
  name: "María Fernanda Gómez",
  toolbar: ALL_ACTIONS,
  strokeLink: false,
  stroke: { minWidth: 0.9, maxWidth: 3.4, smoothing: 0.5, ink: 0, maxSpeed: 1.4 },
};

/**
 * Las props que recibe el componente, ya resueltas. Se muestran en el demo tal cual
 * para que quien lo pruebe pueda copiarlas en su proyecto sin traducir nada.
 */
export function propsFor(config: DemoConfig, pageTheme: PageTheme) {
  const tema = config.fieldTheme === "auto" ? pageTheme : config.fieldTheme;
  const nombre = config.name.trim();
  return {
    locale: config.locale,
    size: config.size,
    theme: tema,
    modes: config.modes,
    initialMode: config.initialMode,
    maxLines: config.maxLines,
    font: config.font,
    maxBytes: config.maxBytesKb * 1024,
    stroke: config.stroke,
    toolbar: config.toolbar,
    strokeLink: config.strokeLink,
    ...(nombre ? { name: nombre } : {}),
  };
}

const clamp = (value: number, min: number, max: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Acepta solo modos conocidos y no vacía la lista: sin modos no hay campo. */
function modosValidos(valor: unknown): SignatureMode[] {
  if (!Array.isArray(valor)) return DEFAULT_CONFIG.modes;
  const modos = ALL_MODES.filter((modo) => valor.includes(modo));
  return modos.length > 0 ? modos : DEFAULT_CONFIG.modes;
}

/** Une lo que llega de la URL con los valores por defecto, sin confiar en nada. */
export function normalizar(parcial: unknown): DemoConfig {
  const datos = (parcial ?? {}) as Partial<DemoConfig>;
  const stroke = (datos.stroke ?? {}) as Partial<DemoConfig["stroke"]>;
  const modos = modosValidos(datos.modes);
  const inicial = modos.includes(datos.initialMode as SignatureMode)
    ? (datos.initialMode as SignatureMode)
    : modos[0]!;
  return {
    preset: typeof datos.preset === "string" ? datos.preset : DEFAULT_CONFIG.preset,
    locale: datos.locale === "es" ? "es" : "en",
    size: datos.size === "sm" || datos.size === "lg" ? datos.size : "md",
    fieldTheme:
      datos.fieldTheme === "light" || datos.fieldTheme === "dark" ? datos.fieldTheme : "auto",
    modes: modos,
    initialMode: inicial,
    maxLines: datos.maxLines === 1 ? 1 : 2,
    font: FONTS.includes(datos.font as TypeFont) ? (datos.font as TypeFont) : DEFAULT_CONFIG.font,
    maxBytesKb: clamp(Number(datos.maxBytesKb), 64, 20480, DEFAULT_CONFIG.maxBytesKb),
    name: typeof datos.name === "string" ? datos.name.slice(0, 80) : "",
    // Una barra sin acciones es válida: el padre manda con el ref. El orden se
    // respeta tal como llega — es la razón de ser de la prop —, así que se filtra
    // contra las acciones conocidas sin reordenarlas y se deduplica.
    toolbar: Array.isArray(datos.toolbar)
      ? datos.toolbar
          .filter((accion): accion is ToolbarAction =>
            ALL_ACTIONS.includes(accion as ToolbarAction)
          )
          .filter((accion, indice, lista) => lista.indexOf(accion) === indice)
      : DEFAULT_CONFIG.toolbar,
    strokeLink: datos.strokeLink === true,
    stroke: {
      minWidth: clamp(Number(stroke.minWidth), 0.2, 6, DEFAULT_CONFIG.stroke.minWidth),
      maxWidth: clamp(Number(stroke.maxWidth), 0.5, 12, DEFAULT_CONFIG.stroke.maxWidth),
      smoothing: clamp(Number(stroke.smoothing), 0, 1, DEFAULT_CONFIG.stroke.smoothing),
      ink: clamp(Number(stroke.ink), 0, 180, DEFAULT_CONFIG.stroke.ink),
      maxSpeed: clamp(Number(stroke.maxSpeed), 0.2, 6, DEFAULT_CONFIG.stroke.maxSpeed),
    },
  };
}

export function encodeConfig(config: DemoConfig): string {
  const json = JSON.stringify(config);
  return btoa(encodeURIComponent(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeConfig(valor: string): DemoConfig | null {
  try {
    const base64 = valor.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64));
    return normalizar(JSON.parse(json));
  } catch {
    return null;
  }
}
