// Presets de tema del campo. Todo se hace con las variables CSS públicas del
// componente (`--signature-*`), así que el demo no necesita API nueva para esto: lo
// que un proyecto puede conseguir con un stylesheet, aquí se cambia en vivo.

export type PageTheme = "light" | "dark";

export type FieldPreset = {
  id: string;
  /** Clase extra para los efectos que una variable no puede expresar. */
  className?: string;
  name: { en: string; es: string };
  note: { en: string; es: string };
  vars: Record<`--signature-${string}`, string>;
};

export const FIELD_PRESETS: FieldPreset[] = [
  {
    id: "impresion",
    name: { en: "Impression", es: "Impresión" },
    note: {
      en: "Paper, ink and one accent. The house style.",
      es: "Papel, tinta y un solo acento. El estilo de casa.",
    },
    vars: {
      "--signature-surface": "#f6f3ea",
      "--signature-color": "#17150f",
      "--signature-ink": "#17150f",
      "--signature-muted": "#5c574a",
      "--signature-rule": "#d9d2c0",
      "--signature-border": "#d9d2c0",
      "--signature-focus": "#c8372d",
      "--signature-radius": "4px",
      "--signature-font": 'ui-serif, Georgia, "Times New Roman", serif',
    },
  },
  {
    id: "cuaderno",
    name: { en: "Notebook", es: "Cuaderno" },
    note: {
      en: "Ruled paper, blue accent, tight corners.",
      es: "Papel rayado, acento azul, esquinas ajustadas.",
    },
    vars: {
      "--signature-surface": "#ffffff",
      "--signature-color": "#12233c",
      "--signature-ink": "#12233c",
      "--signature-muted": "#5b6b80",
      "--signature-rule": "#cfe0f5",
      "--signature-border": "#cfe0f5",
      "--signature-focus": "#2563eb",
      "--signature-radius": "2px",
      "--signature-font": 'ui-serif, Georgia, "Times New Roman", serif',
    },
  },
  {
    id: "tinta",
    name: { en: "Plain ink", es: "Tinta seca" },
    note: {
      en: "Black on white, square, no decoration.",
      es: "Negro sobre blanco, cuadrado, sin decoración.",
    },
    vars: {
      "--signature-surface": "#ffffff",
      "--signature-color": "#000000",
      "--signature-ink": "#000000",
      "--signature-muted": "#666666",
      "--signature-rule": "#000000",
      "--signature-border": "#000000",
      "--signature-focus": "#000000",
      "--signature-radius": "0px",
      "--signature-font": "ui-sans-serif, system-ui, sans-serif",
    },
  },
  {
    id: "medianoche",
    name: { en: "Midnight", es: "Medianoche" },
    note: {
      en: "Dark surface, warm ink, generous radius.",
      es: "Superficie oscura, tinta cálida, radio generoso.",
    },
    vars: {
      "--signature-surface": "#14161a",
      "--signature-color": "#f4f2ec",
      "--signature-ink": "#f4f2ec",
      "--signature-muted": "#8b8f96",
      "--signature-rule": "#2c3038",
      "--signature-border": "#2c3038",
      "--signature-focus": "#f5a524",
      "--signature-radius": "12px",
      "--signature-font": "ui-sans-serif, system-ui, sans-serif",
    },
  },
  {
    id: "jade",
    name: { en: "Jade", es: "Jade" },
    note: {
      en: "Institutional green, soft paper, calm.",
      es: "Verde institucional, papel suave, tranquilo.",
    },
    vars: {
      "--signature-surface": "#f3f7f4",
      "--signature-color": "#10231a",
      "--signature-ink": "#10231a",
      "--signature-muted": "#4d6a5c",
      "--signature-rule": "#cfe3d6",
      "--signature-border": "#cfe3d6",
      "--signature-focus": "#0f7b52",
      "--signature-radius": "16px",
      "--signature-font": 'ui-serif, Georgia, "Times New Roman", serif',
    },
  },
  {
    id: "degradado",
    className: "preset-gradient",
    name: { en: "Gradient", es: "Degradado" },
    note: {
      en: "A gradient sheet with a soft shadow. Pure CSS.",
      es: "Hoja con degradado y sombra suave. Solo CSS.",
    },
    vars: {
      "--signature-surface": "#ffffff",
      "--signature-color": "#241b3a",
      "--signature-ink": "#241b3a",
      "--signature-muted": "#6b6480",
      "--signature-rule": "#e3d9f7",
      "--signature-border": "#e3d9f7",
      "--signature-focus": "#7c3aed",
      "--signature-radius": "22px",
      "--signature-font": "ui-sans-serif, system-ui, sans-serif",
    },
  },
  {
    id: "neon",
    className: "preset-glow",
    name: { en: "Neon", es: "Neón" },
    note: {
      en: "Dark glass with a cyan glow. Easy to overdo.",
      es: "Cristal oscuro con brillo cian. Fácil de exagerar.",
    },
    vars: {
      "--signature-surface": "#0b0c10",
      "--signature-color": "#e6fffb",
      "--signature-ink": "#e6fffb",
      "--signature-muted": "#7c8b90",
      "--signature-rule": "#1d2a2e",
      "--signature-border": "#1d2a2e",
      "--signature-focus": "#22d3ee",
      "--signature-radius": "16px",
      "--signature-font": "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
  },
];

export function presetById(id: string): FieldPreset {
  return FIELD_PRESETS.find((preset) => preset.id === id) ?? FIELD_PRESETS[0]!;
}
