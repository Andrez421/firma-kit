import type { Metadata } from "next";

// El CSS del componente es parte del paquete: sin este import el campo aparece sin
// estilos. `@firma-kit/react` declara los CSS como efectos secundarios para que un
// empaquetador no lo descarte.
import "@firma-kit/react/firma-kit.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "firma-kit — demo",
  description:
    "Four ways to sign, one PNG out, and a visual check that refuses what is not a signature.",
};

// Se aplica el tema guardado antes del primer pintado: sin esto, quien elige oscuro
// ve un destello blanco en cada carga.
const SIN_DESTELLO = `try{const g=localStorage.getItem("firma-kit-demo-theme");const p=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=g==="light"||g==="dark"?g:(p?"dark":"light");}catch{}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIN_DESTELLO }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
