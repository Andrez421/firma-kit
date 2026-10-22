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
          alias: {
            "@firma-kit/core": path.resolve(import.meta.dirname, "packages/core/src"),
            "@firma-kit/verify": path.resolve(import.meta.dirname, "packages/verify/src"),
          },
        },
        test: {
          name: "verify",
          environment: "node",
          include: ["packages/verify/src/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: {
            "@firma-kit/core": path.resolve(import.meta.dirname, "packages/core/src"),
            "@firma-kit/verify": path.resolve(import.meta.dirname, "packages/verify/src"),
          },
        },
        test: {
          name: "eval",
          environment: "node",
          include: ["apps/eval/src/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: { "@firma-kit/core": path.resolve(import.meta.dirname, "packages/core/src") },
        },
        test: {
          name: "react",
          environment: "jsdom",
          // Los tests que necesitan un canvas real corren en Node, no en jsdom.
          exclude: ["packages/react/src/**/*.node.test.ts"],
          include: ["packages/react/src/**/*.test.{ts,tsx}"],
        },
      },
      {
        resolve: {
          alias: { "@firma-kit/core": path.resolve(import.meta.dirname, "packages/core/src") },
        },
        test: {
          name: "react-canvas",
          environment: "node",
          include: ["packages/react/src/**/*.node.test.ts"],
        },
      },
    ],
  },
});
