import type { NextConfig } from "next";

// Los paquetes del workspace se consumen desde su `dist/` compilado en ESM. Next
// los transpila como si fueran código fuente del proyecto.
const config: NextConfig = {
  transpilePackages: ["@firma-kit/react", "@firma-kit/core"],
  reactStrictMode: true,
};

export default config;
