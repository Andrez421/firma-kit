import type { NextConfig } from "next";

// Dos cosas que Next necesita para convivir con este monorepo:
//
// 1. `transpilePackages`: los paquetes del workspace se consumen desde su `dist/`
//    compilado en ESM y Next los transpila como código fuente.
// 2. `extensionAlias`: el repo importa con la extensión `.js` (convención de ESM en
//    TypeScript), pero en disco el fichero es `.ts`. TypeScript lo resuelve solo;
//    webpack no, y falla con "Module not found".
const config: NextConfig = {
  transpilePackages: ["@firma-kit/react", "@firma-kit/core"],
  reactStrictMode: true,
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return webpackConfig;
  },
};

export default config;
