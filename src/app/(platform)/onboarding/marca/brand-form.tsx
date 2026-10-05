"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { FormMessage } from "@/components/ui/field";
import { initialActionState } from "@/lib/errors";
import { BRAND_PRESETS } from "@/lib/studio";
import { saveBrand } from "./actions";

type Props = {
  studioId: string;
  studioName: string;
  initialColor: string;
  initialLogoUrl: string | null;
  skipHref: string;
};

export function BrandForm({ studioId, studioName, initialColor, initialLogoUrl, skipHref }: Props) {
  const [state, action, pending] = useActionState(saveBrand, initialActionState);
  const [color, setColor] = useState(initialColor);
  const [preview, setPreview] = useState<string | null>(initialLogoUrl);

  // Libera la URL temporal de la vista previa.
  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <ActionForm action={action} className="space-y-7">
      <input type="hidden" name="studioId" value={studioId} />

      {/* Vista previa de cómo lo ven los alumnos */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-3 px-4 py-4" style={{ backgroundColor: color }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-10 w-10 rounded-lg bg-white object-contain p-1" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg font-semibold text-white">
              {studioName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-white">{studioName}</span>
        </div>
        <div className="space-y-2 px-4 py-4">
          <div className="h-3 w-2/3 rounded bg-border" />
          <div className="h-3 w-1/2 rounded bg-border" />
          <div className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: color }}>
            Reservar
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Logo</span>
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-surface text-sm text-muted hover:border-foreground">
          {preview ? "Cambiar logo" : "Elegí una imagen"}
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPreview(URL.createObjectURL(file));
            }}
          />
        </label>
        <p className={`text-sm ${state.fieldErrors?.logo ? "text-danger" : "text-muted"}`}>
          {state.fieldErrors?.logo ?? "PNG, JPG o WEBP de hasta 2 MB. Mejor si es cuadrado."}
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Color principal</span>
        <div className="flex flex-wrap items-center gap-3">
          {BRAND_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Usar el color ${c}`}
              aria-pressed={color === c}
              className="h-10 w-10 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-foreground"
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="flex h-10 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted">
            Otro
            <input
              type="color"
              name="brandColor"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
        {state.fieldErrors?.brandColor ? (
          <p className="text-sm text-danger">{state.fieldErrors.brandColor}</p>
        ) : null}
      </div>

      <FormMessage ok={false} message={state.message} />

      <div className="space-y-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar y entrar al panel"}
        </Button>
        <a href={skipHref} className="block py-2 text-center text-sm text-muted hover:text-foreground">
          Lo hago después
        </a>
      </div>
    </ActionForm>
  );
}
