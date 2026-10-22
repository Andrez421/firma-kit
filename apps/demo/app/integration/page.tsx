// Guía de integración: lo que hace falta para tener el campo funcionando en un
// proyecto nuevo. Es la métrica de éxito del producto (< 30 min), así que va al
// grano: instalar, importar el CSS, renderizar y decidir qué hacer con la firma.
import Link from "next/link";

const INSTALL = `pnpm add @firma-kit/core @firma-kit/react`;

const CSS = `import "@firma-kit/react/firma-kit.css";`;

const COMPONENT = `"use client";

import { useState } from "react";
import type { Signature } from "@firma-kit/core";
import { SignatureField } from "@firma-kit/react";

export function FirmaFormulario() {
  const [firma, setFirma] = useState<Signature | null>(null);

  return (
    <form onSubmit={() => guardar(firma)}>
      <SignatureField
        locale="es"
        name="Nombre y apellidos"
        onSignature={setFirma}
        onRejection={(motivo, mensaje) => mostrar(mensaje)}
      />
      <button type="submit" disabled={!firma}>
        Guardar
      </button>
    </form>
  );
}`;

const VERIFIER = `// El modelo no cabe en el navegador: la verificación corre donde vive la imagen.
const verifier = {
  verify: async (imagen) => {
    const res = await fetch(\`\${GATE_URL}/verificar?w=\${imagen.width}&h=\${imagen.height}\`, {
      method: "POST",
      body: new Uint8Array(imagen.data),
      headers: { "x-gate-token": GATE_TOKEN },
      signal: AbortSignal.timeout(8_000),
    });
    return await res.json();
  },
};

<SignatureField verifier={verifier} onSignature={setFirma} />`;

const STORAGE = `// El módulo devuelve la firma; guardarla es decisión tuya.
const bytes = firma.png;              // Uint8Array, PNG opaco sobre blanco
const ancho = firma.width;            // <= 900 px
const cuando = firma.createdAt;       // ISO 8601`;

export default function IntegrationPage() {
  return (
    <main>
      <header className="demo-header">
        <div>
          <h1>Integrating firma-kit</h1>
          <p className="lede">
            The whole integration is the component plus what you decide to do with the
            signature. Nothing here is required beyond the first two steps.
          </p>
        </div>
      </header>

      <h2>1. Install</h2>
      <pre>
        <code>{INSTALL}</code>
      </pre>

      <h2>2. Import the stylesheet once</h2>
      <pre>
        <code>{CSS}</code>
      </pre>
      <p className="lede">
        Without this import the field renders unstyled. The package declares its CSS as
        a side effect, so a bundler will not drop it.
      </p>

      <h2>3. Render it and keep the signature</h2>
      <pre>
        <code>{COMPONENT}</code>
      </pre>
      <p className="lede">
        The four modes (draw, type, upload, camera) are available by default. Use
        <code> modes</code> to offer fewer, and the ref handle (<code>clear</code>,
        <code> confirm</code>, <code>openMode</code>, <code>undo</code>, <code>redo</code>)
        to drive it from outside.
      </p>

      <h2>4. Optional: reject what is not a signature</h2>
      <pre>
        <code>{VERIFIER}</code>
      </pre>
      <p className="lede">
        Verification is a safeguard, not a requirement: if the verifier throws, the field
        still lets the person sign. Run it in your server or a worker — the model is about
        200 MB and never ships to the browser.
      </p>

      <h2>5. Store it however you like</h2>
      <pre>
        <code>{STORAGE}</code>
      </pre>
      <p className="lede">
        The output is always an opaque PNG, ink on white, at most 900 px wide. Storing it
        belongs to your project: database column, object storage, or a file.
      </p>

      <p>
        <Link href="/">← Back to the demo</Link>
      </p>
    </main>
  );
}
