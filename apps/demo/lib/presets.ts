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

  {
    id: "kraft",
    name: { en: "Kraft", es: "Kraft" },
    note: {
      en: "Cardboard, brown ink, warm accent.",
      es: "Cartón, tinta marrón, acento cálido.",
    },
    vars: {
      "--signature-surface": "#efe2cf",
      "--signature-color": "#4a3524",
      "--signature-ink": "#3b2a1c",
      "--signature-muted": "#7d6551",
      "--signature-rule": "#d8c4a8",
      "--signature-border": "#d8c4a8",
      "--signature-focus": "#b45309",
      "--signature-radius": "6px",
      "--signature-font": 'ui-serif, Georgia, "Times New Roman", serif',
    },
  },
  {
    id: "pizarra",
    className: "preset-slate",
    name: { en: "Slate", es: "Pizarra" },
    note: {
      en: "Blackboard with chalk-white ink.",
      es: "Pizarra con tinta blanca de tiza.",
    },
    vars: {
      "--signature-surface": "#26302d",
      "--signature-color": "#f2f5f1",
      "--signature-ink": "#f2f5f1",
      "--signature-muted": "#9fb0a9",
      "--signature-rule": "#3c4a45",
      "--signature-border": "#3c4a45",
      "--signature-focus": "#a7f3d0",
      "--signature-radius": "10px",
      "--signature-font": 'ui-serif, Georgia, "Times New Roman", serif',
    },
  },
  {
    id: "pastel",
    name: { en: "Pastel", es: "Pastel" },
    note: {
      en: "Soft pink sheet, plum ink, generous corners.",
      es: "Hoja rosa suave, tinta ciruela, esquinas generosas.",
    },
    vars: {
      "--signature-surface": "#fdf2f8",
      "--signature-color": "#4a1d3f",
      "--signature-ink": "#4a1d3f",
      "--signature-muted": "#8a5c7c",
      "--signature-rule": "#f5d0e5",
      "--signature-border": "#f5d0e5",
      "--signature-focus": "#db2777",
      "--signature-radius": "24px",
      "--signature-font": 'ui-serif, Georgia, "Times New Roman", serif',
    },
  },
  {
    id: "terminal",
    name: { en: "Terminal", es: "Terminal" },
    note: {
      en: "Green on black, monospace, square. For the brave.",
      es: "Verde sobre negro, monoespaciada, cuadrada. Para valientes.",
    },
    vars: {
      "--signature-surface": "#06120c",
      "--signature-color": "#7cf7a8",
      "--signature-ink": "#7cf7a8",
      "--signature-muted": "#3f7a58",
      "--signature-rule": "#12472c",
      "--signature-border": "#12472c",
      "--signature-focus": "#22c55e",
      "--signature-radius": "0px",
      "--signature-font": "ui-monospace, SFMono-Regular, Menlo, monospace",
    },
  },
  {
    id: "acuarela",
    className: "preset-watercolour",
    name: { en: "Watercolour", es: "Acuarela" },
    note: {
      en: "Washed paper with a soft bloom behind the sheet.",
      es: "Papel lavado con un halo suave detrás de la hoja.",
    },
    vars: {
      "--signature-surface": "#ffffff",
      "--signature-color": "#2a2350",
      "--signature-ink": "#2a2350",
      "--signature-muted": "#6a6490",
      "--signature-rule": "#dcd8f5",
      "--signature-border": "#dcd8f5",
      "--signature-focus": "#6366f1",
      "--signature-radius": "18px",
      "--signature-font": 'ui-serif, Georgia, "Times New Roman", serif',
    },
  },
];

export function presetById(id: string): FieldPreset {
  return FIELD_PRESETS.find((preset) => preset.id === id) ?? FIELD_PRESETS[0]!;
}
