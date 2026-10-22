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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
