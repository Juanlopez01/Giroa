import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desarrollo con subdominios: *.lvh.me apunta a 127.0.0.1 y permite compartir
  // la cookie de sesión entre app. y los estudios (con *.localhost no se puede).
  allowedDevOrigins: ["lvh.me", "*.lvh.me", "*.localhost"],
  // Nadie puede mostrar Giroa dentro de otro sitio (clickjacking), salvo el
  // widget de la grilla (/embed), que el estudio pega en su propia web. Si dos
  // reglas coinciden, gana la última.
  async headers() {
    const csp = (ancestors: string) => [{ key: "Content-Security-Policy", value: `frame-ancestors ${ancestors}` }];
    return [
      { source: "/:path*", headers: csp("'self'") },
      { source: "/embed", headers: csp("*") },
      { source: "/s/:slug/embed", headers: csp("*") },
    ];
  },
  experimental: {
    serverActions: {
      // Las imágenes (logo, portada) se suben directo a Storage desde el navegador.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
