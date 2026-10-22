"use client";

// Modal de rechazo. El campo ya explica el motivo en su mensaje; esto lo pone delante
// de la persona en vez de dejarlo como una nota al pie que se puede pasar por alto.
// Sigue el patrón de diálogo accesible: role dialog, aria-modal, foco al abrir, Escape
// para cerrar y clic en el fondo.
import { useEffect, useRef } from "react";

type Props = {
  title: string;
  message: string;
  close: string;
  onClose: () => void;
};

export function RejectionDialog({ title, message, close, onClose }: Props) {
  const boton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    boton.current?.focus();
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onClose();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rejection-title"
        aria-describedby="rejection-body"
      >
        <p className="dialog-eyebrow">{title}</p>
        <p className="dialog-body" id="rejection-body">
          {message}
        </p>
        <button ref={boton} type="button" className="demo-button" onClick={onClose}>
          {close}
        </button>
      </div>
    </div>
  );
}
