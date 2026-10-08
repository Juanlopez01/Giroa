import type { MetadataRoute } from "next";

// "Agregar a inicio" en el celular. start_url relativo: en el subdominio de un
// estudio abre la página del estudio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Giroa",
    short_name: "Giroa",
    description: "Reservas, packs y pagos para estudios de danza y movimiento.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1ea",
    theme_color: "#6b1f2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
