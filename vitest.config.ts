import path from "node:path";
import { defineConfig } from "vitest/config";

// Núcleo sin DOM: los tests del pipeline de tinta corren en Node puro.
// Los paquetes con React (react/, demo) traerán su propio proyecto jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: { "@firma-kit/core": path.resolve(import.meta.dirname, "packages/core/src") },
        },
        test: {
          name: "core",
          environment: "node",
          include: ["packages/core/src/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: { "@firma-kit/core": path.resolve(import.meta.dirname, "packages/core/src") },
        },
        test: {
          name: "react",
          environment: "jsdom",
          include: ["packages/react/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
