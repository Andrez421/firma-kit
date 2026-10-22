// Banco de pruebas manual de los cuatro modos. Sirve para lo que ningún test
// headless puede verificar: cómo se ven las cursivas reales y si el PNG sale
// con tinta sobre blanco.

import type { Signature } from "@firma-kit/core";
import { SignatureField, toPngBlob } from "@firma-kit/react";
import { useEffect, useMemo, useState } from "react";

type Tema = "auto" | "light" | "dark";

// Presets de personalización: un integrador tiene que poder VER el efecto de los
// tokens, no deducirlo leyendo el CSS.
const PRESETS = {
  "Por defecto": { brand: "#111827", accent: "#2563eb", radius: 10 },
  Corporativo: { brand: "#0f172a", accent: "#0ea5e9", radius: 4 },
  Cálido: { brand: "#3f2d20", accent: "#b45309", radius: 16 },
} as const;

type PresetNombre = keyof typeof PRESETS;

export function App() {
  const [theme, setTheme] = useState<Tema>("auto");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [preset, setPreset] = useState<PresetNombre>("Por defecto");
  const tokens = PRESETS[preset];
  const [name, setName] = useState("José Muñoz Peña");
  const [signature, setSignature] = useState<Signature | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  // El object URL se revoca al cambiar la firma: crearlo en cada render dejaba
  // blobs vivos hasta cerrar la pestaña.
  const url = useMemo(
    () => (signature ? URL.createObjectURL(toPngBlob(signature)) : null),
    [signature]
  );
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <main
      style={{
        // Colores del sistema: la página acompaña el esquema en vez de quedarse
        // blanca bajo un sistema oscuro.
        background: "Canvas",
        color: "CanvasText",
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <h1 style={{ maxWidth: 720 }}>signature-kit · playground</h1>

      <label style={{ display: "block", marginBottom: 12 }}>
        <span>Tema: </span>
        <select
          value={theme}
          onChange={(evento) => setTheme(evento.target.value as Tema)}
          style={{ minHeight: 32 }}
        >
          <option value="auto">Sistema</option>
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </select>
      </label>

      <label style={{ display: "block", marginBottom: 12 }}>
        <span>Nombre a escribir</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          style={{ display: "block", minHeight: 44, width: "100%" }}
        />
      </label>

      <fieldset
        style={{ border: "1px solid #d1d5db", borderRadius: 8, marginBottom: 16, padding: 12 }}
      >
        <legend>Personalización</legend>
        <label style={{ marginRight: 12 }}>
          Tema visual:{" "}
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PresetNombre)}
          >
            {Object.keys(PRESETS).map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tamaño del campo:{" "}
          <select value={size} onChange={(e) => setSize(e.target.value as "sm" | "md" | "lg")}>
            <option value="sm">Pequeño (140px de lienzo)</option>
            <option value="md">Mediano (200px)</option>
            <option value="lg">Grande (280px)</option>
          </select>
        </label>
      </fieldset>

      <SignatureField
        size={size}
        style={
          {
            "--signature-color": tokens.brand,
            "--signature-focus": tokens.accent,
            "--signature-radius": `${tokens.radius}px`,
          } as React.CSSProperties
        }
        name={name}
        {...(theme === "auto" ? {} : { theme })}
        onSignature={(next) => {
          setSignature(next);
          setRejection(null);
        }}
        onRejection={(_motivo, message) => {
          setSignature(null);
          setRejection(message);
        }}
      />

      {rejection ? <p role="status">Rechazo: {rejection}</p> : null}

      {signature && url ? (
        <section>
          <h2>Resultado ({signature.width}×{signature.height})</h2>
          <p>
            Modo: {signature.mode}
            {signature.enhanced ? " · niveles realzados" : ""} ·{" "}
            {Math.round(signature.png.byteLength / 1024)} KB
          </p>
          <img
            src={url}
            alt="Firma generada"
            style={{ border: "1px solid #d1d5db", maxWidth: "100%" }}
          />
          <p>
            <a href={url} download="firma.png">
              Descargar PNG
            </a>
          </p>
        </section>
      ) : null}
    </main>
  );
}
