"use client";

import { useState, useTransition } from "react";
import { Megaphone, X } from "lucide-react";
import type { ActionState } from "@/lib/errors";

export type AnnouncementItem = { id: string; title: string; body: string };

/** Anuncios del estudio arriba del Inicio. Al cerrarlos, no vuelven a aparecer. */
export function Announcements({
  items,
  dismiss,
}: {
  items: AnnouncementItem[];
  dismiss: (id: string) => Promise<ActionState>;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const visible = items.filter((a) => !hidden.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <section key={a.id} className="relative flex gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Megaphone className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{a.title}</p>
            <p className="text-sm whitespace-pre-line text-muted">{a.body}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar anuncio"
            onClick={() => {
              setHidden((s) => new Set(s).add(a.id));
              start(async () => {
                await dismiss(a.id);
              });
            }}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-border/50 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </section>
      ))}
    </div>
  );
}
