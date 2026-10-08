"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "giroa:install-dismissed";

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // modo privado: no pasa nada
  }
}

/**
 * Invita a instalar la app del estudio en la pantalla de inicio.
 * Android/Chrome: botón con el aviso nativo. iPhone: instrucciones (Safari no
 * tiene aviso nativo). No aparece si ya está instalada o si la cerraron.
 */
export function InstallPrompt({ studioName, app = "student" }: { studioName: string; app?: "student" | "panel" }) {
  const dismissKey = app === "panel" ? `${DISMISS_KEY}:panel` : DISMISS_KEY;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || safeGet(dismissKey)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos) timer = setTimeout(() => setMode("ios"), 0);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, [dismissKey]);

  if (mode === "hidden") return null;

  const dismiss = () => {
    safeSet(dismissKey, "1");
    setMode("hidden");
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
      <div className="flex-1">
        <p className="font-medium">{app === "panel" ? `Instalá el panel de ${studioName}` : `Instalá la app de ${studioName}`}</p>
        {mode === "ios" ? (
          <p className="text-muted">
            Tocá <span className="font-medium">Compartir</span> y después{" "}
            <span className="font-medium">“Agregar a inicio”</span>.
          </p>
        ) : (
          <p className="text-muted">{app === "panel" ? "Agenda, alumnos y cobros a un toque, como cualquier app." : "Reservá en un toque, como cualquier app."}</p>
        )}
        {mode === "android" && deferred ? (
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
              setMode("hidden");
            }}
            className="mt-2 h-9 rounded-xl bg-brand px-4 font-medium text-brand-foreground"
          >
            Instalar
          </button>
        ) : null}
      </div>
      <button type="button" onClick={dismiss} aria-label="Cerrar" className="text-muted hover:text-foreground">
        ✕
      </button>
    </div>
  );
}
