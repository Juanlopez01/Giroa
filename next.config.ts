import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desarrollo con subdominios: *.lvh.me apunta a 127.0.0.1 y permite compartir
  // la cookie de sesión entre app. y los estudios (con *.localhost no se puede).
  allowedDevOrigins: ["lvh.me", "*.lvh.me", "*.localhost"],
  experimental: {
    serverActions: {
      // Las imágenes (logo, portada) se suben directo a Storage desde el navegador.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
