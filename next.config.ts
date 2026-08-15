import type { NextConfig } from "next";

const nombreRepositorio = "inventario-dashboard";

const nextConfig = {
  output: "export",
  basePath: `/${nombreRepositorio}`,
  assetPrefix: `/${nombreRepositorio}/`,
  trailingSlash: true,
};

export default nextConfig;