"use client";

import { useState } from "react";

/** Compartir el link de invitación: WhatsApp, menú del celular o copiar. */
export function ShareInvite({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el link igual está a la vista para copiarlo a mano.
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Lo canceló: no pasa nada.
        return;
      }
    }
    await copy();
  };

  return (
    <div className="space-y-3">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-full items-center justify-center rounded-full bg-[#25d366] text-sm font-semibold text-white"
      >
        Invitar por WhatsApp
      </a>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={share}
          className="h-11 flex-1 rounded-full border border-border bg-surface text-sm font-medium"
        >
          Compartir
        </button>
        <button type="button" onClick={copy} className="h-11 flex-1 rounded-full border border-border bg-surface text-sm font-medium">
          {copied ? "¡Copiado!" : "Copiar link"}
        </button>
      </div>
      <p className="truncate rounded-xl bg-border/40 px-3 py-2 text-center text-sm text-muted select-all">{link}</p>
    </div>
  );
}
