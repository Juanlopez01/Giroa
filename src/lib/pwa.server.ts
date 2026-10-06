import "server-only";
import type { NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { resolveHost } from "@/lib/tenancy/host";
import { getStudioBySlug, type PublicStudio } from "@/lib/studio.server";

/** Estudio del host del request (para manifest e íconos), o null si es Giroa. */
export async function studioFromRequest(request: NextRequest): Promise<PublicStudio | null> {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const target = resolveHost(host, publicEnv().NEXT_PUBLIC_ROOT_DOMAIN);
  return target.kind === "studio" ? getStudioBySlug(target.slug) : null;
}

export const GIROA_BRAND = { name: "Giroa", color: "#6b1f2e", background: "#f6f1ea" };
