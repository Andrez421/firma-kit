// Banco de pruebas manual de los cuatro modos, vestido con el mundo del
// componente: escritorio neutro y la hoja encima. Sirve para lo que ningún test
// headless verifica: cómo se ven las cursivas reales y si el PNG sale con tinta
// sobre blanco.

import type { Bitmap, Signature, Verdict } from "@firma-kit/core";
import { SignatureField, toPngBlob } from "@firma-kit/react";
import { useEffect, useMemo, useState } from "react";

type Tema = "auto" | "light" | "dark";

// Servicio local del gate (`pnpm --filter @firma-kit/eval serve`). El modelo vive
// en Node: el navegador no puede cargar 201 MB de ONNX en cada visita.
//
// El host sale de la página, no de `127.0.0.1`: abierto desde el móvil por
// Tailscale, `127.0.0.1` sería el localhost del teléfono y la verificación
// fallaría en silencio.
const GATE_URL =
  import.meta.env["VITE_GATE_URL"] ??
  `${window.location.protocol}//${window.location.hostname}:8790`;

// Direcciones de color para probar el contrato de personalización sin escribir
// una hoja de estilos: papel/tinta y un acento distinto por preset.
// Un preset solo mueve el acento y el radio del borde. La tinta y el papel los
// decide el componente según su tema: si el preset fijara `--signature-color`,
// en modo oscuro el texto quedaría negro sobre negro.
const PRESETS = {
  "La impresión": { accent: "#c8372d", radius: 2 },
  "Tinta azul": { accent: "#1d4ed8", radius: 4 },
  "Papel viejo": { accent: "#b45309", radius: 0 },
} as const;

type PresetNombre = keyof typeof PRESETS;

export function App() {
  const [theme, setTheme] = useState<Tema>("auto");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [preset, setPreset] = useState<PresetNombre>("La impresión");
  const [name, setName] = useState("José Muñoz Peña");
  const [signature, setSignature] = useState<Signature | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [gate, setGate] = useState<"comprobando" | "conectado" | "sin servicio">("comprobando");
  const tokens = PRESETS[preset];

  // Sonda de salud: si el servicio no está, el campo se comporta como antes (sin
  // verificación) y el arnés lo dice en pantalla.
  useEffect(() => {
    let vigente = true;
    fetch(`${GATE_URL}/salud`)
      .then((res) => res.ok)
      .then((ok) => vigente && setGate(ok ? "conectado" : "sin servicio"))
      .catch(() => vigente && setGate("sin servicio"));
    return () => {
      vigente = false;
    };
  }, []);

  const verifier = useMemo(
    () => ({
      verify: async (imagen: Bitmap): Promise<Verdict> => {
        try {
          const res = await fetch(
            `${GATE_URL}/verificar?w=${imagen.width}&h=${imagen.height}`,
            // Copia con su propio ArrayBuffer: `Uint8Array<ArrayBufferLike>` no es
            // un `BodyInit` válido en TypeScript.
            { method: "POST", body: new Uint8Array(imagen.data) }
          );
          if (!res.ok) throw new Error(`el gate respondió ${res.status}`);
          return (await res.json()) as Verdict;
        } catch (error) {
          // El campo ignora a propósito los fallos del verificador para no dejar a
          // nadie sin firmar; aquí, en el arnés, ese silencio se convierte en un
          // aviso visible: si no hay gate, no se está validando nada.
          setGate("sin servicio");
          throw error;
        }
      },
    }),
    []
  );

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
        margin: "0 auto",
        maxWidth: 720,
        padding: "48px 20px 96px",
      }}
    >
      <header style={{ marginBottom: 36 }}>
        <h1
          style={{
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          signature-kit
        </h1>
        <p style={{ color: "var(--muted)", margin: "6px 0 0" }}>
          Banco de pruebas: los cuatro modos, con las fuentes reales.
        </p>
        <p
          style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 0" }}
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            style={{
              background:
                gate === "conectado"
                  ? "var(--accent)"
                  : gate === "sin servicio"
                    ? "var(--rule)"
                    : "var(--muted)",
              display: "inline-block",
              height: 8,
              marginRight: 8,
              width: 8,
            }}
          />
          Verificación visual: {gate}
          {gate === "sin servicio"
            ? " (arranca `pnpm --filter @firma-kit/eval serve`)"
            : ""}
        </p>
      </header>

      <section
        aria-label="Personalización"
        style={{
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          marginBottom: 28,
          paddingBottom: 20,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Tema</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Tema)}>
            <option value="auto">Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Dirección</span>
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
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Tamaño</span>
          <select value={size} onChange={(e) => setSize(e.target.value as "sm" | "md" | "lg")}>
            <option value="sm">Pequeño</option>
            <option value="md">Mediano</option>
            <option value="lg">Grande</option>
          </select>
        </label>
        <label
          style={{ display: "flex", flex: "1 1 220px", flexDirection: "column", gap: 6 }}
        >
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Nombre a escribir</span>
          <input
            value={name}
            onChange={(evento) => setName(evento.target.value)}
            style={{
              background: "transparent",
              border: 0,
              borderBottom: "1px solid var(--rule)",
              color: "inherit",
              font: "inherit",
              minHeight: 40,
              padding: "6px 2px",
            }}
          />
        </label>
      </section>

      <SignatureField
        size={size}
        style={
          {
            "--signature-focus": tokens.accent,
            "--signature-radius": `${tokens.radius}px`,
          } as React.CSSProperties
        }
        name={name}
        locale="es"
        {...(gate === "conectado" ? { verifier } : {})}
        {...(theme === "auto" ? {} : { theme })}
        onSignature={(next) => {
          setSignature(next);
          setRejection(null);
        }}
        onRejection={(_motivo, mensaje) => {
          setSignature(null);
          setRejection(mensaje);
        }}
      />

      {rejection ? (
        <p role="status" style={{ color: "var(--muted)", marginTop: 24 }}>
          {rejection}
        </p>
      ) : null}

      {signature && url ? (
        <section style={{ borderTop: "1px solid var(--rule)", marginTop: 32, paddingTop: 20 }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 4px" }}>La impresión</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
            {signature.mode} · {signature.width}×{signature.height} px ·{" "}
            {Math.round(signature.png.byteLength / 1024)} KB
            {signature.enhanced ? " · niveles realzados" : ""}
          </p>
          {/* La impresión ya se ve dentro del campo: aquí solo se descarga. */}
          <p style={{ marginTop: 14 }}>
            <a
              href={url}
              download="firma.png"
              style={{ color: "var(--accent)", textUnderlineOffset: 3 }}
            >
              Descargar PNG
            </a>
          </p>
        </section>
      ) : null}
    </main>
  );
}
