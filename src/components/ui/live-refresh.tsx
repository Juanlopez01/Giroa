"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir la página cada `everyMs` mientras está a la vista (p. ej. la
 * lista de una clase mientras los alumnos se dan el presente). Se corta sola
 * después de `maxMinutes` para no quedar consultando para siempre.
 */
export function LiveRefresh({ everyMs = 10_000, maxMinutes = 120 }: { everyMs?: number; maxMinutes?: number }) {
  const router = useRouter();
  useEffect(() => {
    const until = Date.now() + maxMinutes * 60_000;
    const id = setInterval(() => {
      if (Date.now() > until) return clearInterval(id);
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, maxMinutes]);
  return null;
}
