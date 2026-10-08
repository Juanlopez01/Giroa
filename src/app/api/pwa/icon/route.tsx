import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { GIROA_BRAND, studioFromRequest } from "@/lib/pwa.server";
import { logoUrl } from "@/lib/studio";
import { readableOn } from "@/lib/color";

const SIZES = new Set([180, 192, 512]);

// Ícono de la PWA: el logo del estudio sobre blanco, o su inicial sobre su
// color de marca. "maskable" deja margen para que Android lo recorte en círculo.
// El del panel (app=panel) lleva una marca de "tablero" abajo a la derecha,
// para no confundirlo con la app del alumno en la pantalla de inicio.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = Number(params.get("size"));
  const size = SIZES.has(requested) ? requested : 192;
  const maskable = params.get("maskable") === "1";
  const panel = params.get("app") === "panel";

  const studio = await studioFromRequest(request);
  const color = studio?.brand_color ?? GIROA_BRAND.color;
  const fg = readableOn(color);
  const letter = (studio?.name ?? "g").slice(0, 1).toUpperCase();
  const logo = logoUrl(studio?.logo_path);
  const pad = Math.round(size * (maskable ? 0.2 : 0.12));

  // Marca del panel: un círculo del color del estudio con una grilla de 2x2.
  const badge = Math.round(size * (maskable ? 0.26 : 0.32));
  const inset = Math.round(size * (maskable ? 0.17 : 0.06));
  const cell = Math.round(badge * 0.2);
  const gap = Math.round(badge * 0.08);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        {logo ? (
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
              color: fg,
              fontSize: Math.round(size * (maskable ? 0.42 : 0.55)),
              fontWeight: 700,
            }}
          >
            {studio ? letter : "g"}
          </div>
        )}
        {panel ? (
          <div
            style={{
              position: "absolute",
              right: inset,
              bottom: inset,
              width: badge,
              height: badge,
              borderRadius: badge,
              background: logo ? color : fg,
              border: `${Math.max(2, Math.round(size * 0.015))}px solid ${logo ? "#ffffff" : color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap,
            }}
          >
            {[0, 1].map((row) => (
              <div key={row} style={{ display: "flex", gap }}>
                {[0, 1].map((col) => (
                  <div key={col} style={{ width: cell, height: cell, borderRadius: Math.round(cell * 0.3), background: logo ? fg : color }} />
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
