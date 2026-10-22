// Banco de pruebas manual de los cuatro modos. Sirve para lo que ningún test
// headless puede verificar: cómo se ven las cursivas reales y si el PNG sale
// con tinta sobre blanco.

import type { Signature } from "@firma-kit/core";
import { SignatureField, toPngBlob } from "@firma-kit/react";
import { useState } from "react";

export function App() {
  const [name, setNombre] = useState("José Muñoz Peña");
  const [signature, setFirma] = useState<Signature | null>(null);
  const [rejection, setRechazo] = useState<string | null>(null);

  const url = signature ? URL.createObjectURL(toPngBlob(signature)) : null;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720 }}>
      <h1>signature-kit · playground</h1>

      <label style={{ display: "block", marginBottom: 12 }}>
        <span>Nombre a escribir</span>
        <input
          value={name}
          onChange={(event) => setNombre(event.target.value)}
          style={{ display: "block", minHeight: 44, width: "100%" }}
        />
      </label>

      <SignatureField
        name={name}
        onSignature={(nueva) => {
          setFirma(nueva);
          setRechazo(null);
        }}
        onRejection={(_motivo, message) => {
          setFirma(null);
          setRechazo(message);
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
