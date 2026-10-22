import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// El playground consume el código fuente, no `dist`: así se prueba lo que se
// acaba de escribir sin compilar paquetes a mano.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@firma-kit/core": path.resolve(import.meta.dirname, "../../packages/core/src"),
      "@firma-kit/react/firma-kit.css": path.resolve(
        import.meta.dirname,
        "../../packages/react/firma-kit.css"
      ),
      "@firma-kit/react/fonts.css": path.resolve(
        import.meta.dirname,
        "../../packages/react/assets/fonts.css"
      ),
      "@firma-kit/react": path.resolve(import.meta.dirname, "../../packages/react/src"),
    },
  },
});
