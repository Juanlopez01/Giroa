import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { GIROA_BRAND, studioFromRequest } from "@/lib/pwa.server";
import { logoUrl } from "@/lib/studio";
import { readableOn } from "@/lib/color";

const SIZES = new Set([180, 192, 512]);

// Ícono de la PWA: el logo del estudio sobre blanco, o su inicial sobre su
// color de marca. "maskable" deja margen para que Android lo recorte en círculo.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = Number(params.get("size"));
  const size = SIZES.has(requested) ? requested : 192;
  const maskable = params.get("maskable") === "1";

  const studio = await studioFromRequest(request);
  const color = studio?.brand_color ?? GIROA_BRAND.color;
  const letter = (studio?.name ?? "g").slice(0, 1).toUpperCase();
  const logo = logoUrl(studio?.logo_path);
  const pad = Math.round(size * (maskable ? 0.2 : 0.12));

  return new ImageResponse(
    logo ? (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={size - pad * 2} height={size - pad * 2} style={{ objectFit: "contain" }} />
      </div>
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          color: readableOn(color),
          fontSize: Math.round(size * (maskable ? 0.42 : 0.55)),
          fontWeight: 700,
        }}
      >
        {studio ? letter : "g"}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
