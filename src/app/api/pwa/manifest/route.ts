import { NextResponse, type NextRequest } from "next/server";
import { GIROA_BRAND, studioFromRequest } from "@/lib/pwa.server";

// Manifest de la PWA según el host: en {slug}.giroa.com.ar se instala "la app del
// estudio" con su nombre, color y logo; en Giroa, la app de Giroa.
export async function GET(request: NextRequest) {
  const studio = await studioFromRequest(request);

  const manifest = studio
    ? {
        id: `/?studio=${studio.slug}`,
        name: studio.name,
        short_name: studio.name.length > 12 ? studio.name.split(" ")[0] : studio.name,
        description: `Reservá tus clases en ${studio.name}`,
        start_url: "/app",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: studio.brand_color,
        lang: "es-AR",
        icons: [
          { src: "/api/pwa/icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/api/pwa/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/api/pwa/icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      }
    : {
        id: "/",
        name: GIROA_BRAND.name,
        short_name: GIROA_BRAND.name,
        start_url: "/estudios",
        display: "standalone",
        background_color: GIROA_BRAND.background,
        theme_color: GIROA_BRAND.color,
        lang: "es-AR",
        icons: [
          { src: "/api/pwa/icon?size=192", sizes: "192x192", type: "image/png" },
          { src: "/api/pwa/icon?size=512", sizes: "512x512", type: "image/png" },
        ],
      };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
