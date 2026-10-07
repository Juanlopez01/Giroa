"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { FormMessage } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import { BRAND_PALETTES } from "@/lib/studio";
import { isTooLight, legibleVariant, readableOn } from "@/lib/color";
import { createClient } from "@/lib/supabase/client";

const MAX = { logo: 2 * 1024 * 1024, cover: 4 * 1024 * 1024 } as const;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Sube la imagen directo a Storage (la política solo deja al owner/admin del estudio). */
async function uploadImage(studioId: string, kind: "logo" | "cover", file: File): Promise<{ path: string } | { error: string }> {
  const label = kind === "logo" ? "El logo" : "La portada";
  const ext = EXT[file.type];
  if (!ext) return { error: `${label} tiene que ser PNG, JPG o WEBP.` };
  if (file.size > MAX[kind]) return { error: `${label} puede pesar hasta ${MAX[kind] / 1024 / 1024} MB.` };
  const path = `${studioId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await createClient().storage.from("studio-assets").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `No pudimos subir ${kind === "logo" ? "el logo" : "la portada"}. Probá con otra imagen.` };
  return { path };
}

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  studioId: string;
  studioName: string;
  initialColor: string;
  initialLogoUrl: string | null;
  initialCoverUrl: string | null;
  submitLabel: string;
  /** Link para saltear (onboarding). */
  skipHref?: string;
};

/** Marca del estudio: paletas curadas o color propio, logo y foto de portada, con vista previa. */
export function StudioBrandForm({
  action,
  studioId,
  studioName,
  initialColor,
  initialLogoUrl,
  initialCoverUrl,
  submitLabel,
  skipHref,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [color, setColor] = useState(initialColor);
  const [logo, setLogo] = useState<string | null>(initialLogoUrl);
  const [cover, setCover] = useState<string | null>(initialCoverUrl);
  const [removeCover, setRemoveCover] = useState(false);
  const [paths, setPaths] = useState<{ logo: string; cover: string }>({ logo: "", cover: "" });
  const [uploadErrors, setUploadErrors] = useState<{ logo?: string; cover?: string }>({});
  const [uploading, setUploading] = useState(0);
  const errors: Record<string, string | undefined> = { ...(state.fieldErrors ?? {}), ...uploadErrors };

  const pick = async (kind: "logo" | "cover", file: File) => {
    setUploading((n) => n + 1);
    const r = await uploadImage(studioId, kind, file);
    setUploading((n) => n - 1);
    if ("error" in r) {
      setUploadErrors((e) => ({ ...e, [kind]: r.error }));
      return;
    }
    setUploadErrors((e) => ({ ...e, [kind]: undefined }));
    setPaths((p) => ({ ...p, [kind]: r.path }));
    const url = URL.createObjectURL(file);
    if (kind === "logo") setLogo(url);
    else {
      setCover(url);
      setRemoveCover(false);
    }
  };

  // Libera las URLs temporales de las vistas previas.
  useEffect(() => () => void (logo?.startsWith("blob:") && URL.revokeObjectURL(logo)), [logo]);
  useEffect(() => () => void (cover?.startsWith("blob:") && URL.revokeObjectURL(cover)), [cover]);

  const accent = legibleVariant(color);
  const fg = readableOn(accent);
  const tooLight = isTooLight(color);

  return (
    <ActionForm action={formAction} className="space-y-7">
      <input type="hidden" name="studioId" value={studioId} />
      <input type="hidden" name="brandColor" value={color} />
      <input type="hidden" name="removeCover" value={removeCover ? "1" : ""} />
      <input type="hidden" name="logoPath" value={paths.logo} />
      <input type="hidden" name="coverPath" value={paths.cover} />

      {/* Vista previa: así lo ven los alumnos */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <PreviewHeader name={studioName} logo={logo} cover={cover} color={accent} fg={fg} />
        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-border border-l-4 bg-background p-3" style={{ borderLeftColor: accent }}>
            <p className="text-sm font-semibold">Te quedan 5 clases</p>
            <p className="text-xs text-muted">Vence el 12/11</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-xs text-muted">Lunes 19:00</p>
              <p className="text-sm font-medium">Clase de ejemplo</p>
            </div>
            <span className="rounded-lg px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: accent, color: fg }}>
              Reservar
            </span>
          </div>
        </div>
      </div>

      {/* Color */}
      <div className="space-y-3">
        <span className="text-sm font-medium">Color</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {BRAND_PALETTES.map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-surface p-3">
              <p className="mb-2 text-xs text-muted">{p.name}</p>
              <div className="flex gap-2">
                {p.colors.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    aria-label={`Usar ${c.label}`}
                    aria-pressed={color.toLowerCase() === c.hex}
                    title={c.label}
                    className="h-9 w-9 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-foreground"
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <label className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted">
          Otro color
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        {tooLight ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--gold)]/15 px-3 py-2 text-sm">
            <span>Ese color es muy claro y no se lee bien sobre fondo blanco.</span>
            <button
              type="button"
              onClick={() => setColor(legibleVariant(color))}
              className="inline-flex items-center gap-1.5 font-medium underline"
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: legibleVariant(color) }} />
              Usar una versión más oscura
            </button>
          </div>
        ) : null}
        {errors.brandColor ? <p className="text-sm text-danger">{errors.brandColor}</p> : null}
      </div>

      {/* Logo */}
      <ImageInput
        label="Logo"
        hint="PNG, JPG o WEBP de hasta 2 MB. Mejor cuadrado y con fondo transparente."
        error={errors.logo}
        hasImage={Boolean(logo)}
        onPick={(file) => void pick("logo", file)}
      />

      {/* Portada */}
      <div className="space-y-2">
        <ImageInput
          label="Foto de portada"
          hint="Opcional. JPG o WEBP de hasta 4 MB, horizontal. El salón, la barra, una sala con luz."
          error={errors.cover}
          hasImage={Boolean(cover)}
          onPick={(file) => void pick("cover", file)}
        />
        {cover ? (
          <button
            type="button"
            onClick={() => {
              setCover(null);
              setPaths((p) => ({ ...p, cover: "" }));
              setRemoveCover(true);
            }}
            className="text-sm text-muted hover:text-danger"
          >
            Quitar portada
          </button>
        ) : null}
      </div>

      <FormMessage ok={state.ok} message={state.message} />
      <div className="space-y-3">
        <Button type="submit" disabled={pending || uploading > 0}>
          {uploading > 0 ? "Subiendo imagen…" : pending ? "Guardando…" : submitLabel}
        </Button>
        {skipHref ? (
          <a href={skipHref} className="block py-2 text-center text-sm text-muted hover:text-foreground">
            Lo hago después
          </a>
        ) : null}
      </div>
    </ActionForm>
  );
}

function PreviewHeader({ name, logo, cover, color, fg }: { name: string; logo: string | null; cover: string | null; color: string; fg: string }) {
  return (
    <div className="relative flex min-h-24 items-end px-4 py-4" style={cover ? undefined : { backgroundColor: color }}>
      {cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        </>
      ) : null}
      <div className="relative flex items-center gap-3" style={{ color: cover ? "#ffffff" : fg }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-1" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-lg font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="text-lg font-semibold">{name}</span>
      </div>
    </div>
  );
}

function ImageInput({
  label,
  hint,
  error,
  hasImage,
  onPick,
}: {
  label: string;
  hint: string;
  error?: string;
  hasImage: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 text-sm font-medium hover:border-brand">
        {hasImage ? `Cambiar ${label.toLowerCase()}` : "Elegí una imagen"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = "";
          }}
        />
      </label>
      <p className={`text-sm ${error ? "text-danger" : "text-muted"}`}>{error ?? hint}</p>
    </div>
  );
}
