"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Mientras el pago se confirma, vuelve a pedir la página cada 4 s (hasta 3 minutos). */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (tries > 45) clearInterval(id);
      else router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
