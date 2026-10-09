"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { initialActionState } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { marketingUrl } from "@/lib/urls";
import { checkSlug, createStudio, type SlugStatus } from "./actions";

const slugMessages: Record<SlugStatus, string> = {
  available: "¡Está libre!",
  invalid: "Usá entre 3 y 40 letras minúsculas, números o guiones.",
  reserved: "Esa dirección está reservada. Probá con otra.",
  taken: "Esa dirección ya está en uso. Probá con otra.",
  error: "No pudimos chequear la dirección. Probá de nuevo.",
};

export function StudioForm({ rootDomain }: { rootDomain: string }) {
  const [state, action, pending] = useActionState(createStudio, initialActionState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<{ slug: string; value: SlugStatus } | null>(null);

  // Chequea la disponibilidad con una pausa corta mientras escribe.
  useEffect(() => {
    if (slug.length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const value = await checkSlug(slug);
      if (!cancelled) setStatus({ slug, value });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug]);

  const current = status?.slug === slug ? status.value : null;
  const slugError = state.fieldErrors?.slug ?? (current && current !== "available" ? slugMessages[current] : undefined);

  return (
    <ActionForm action={action} className="space-y-5">
      <Field label="Nombre del estudio" error={state.fieldErrors?.name}>
        <Input
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="Ej.: Tango Sur"
          autoComplete="organization"
          required
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
      </Field>

      <Field
        label="Dirección de tu estudio"
        error={slugError}
        hint={
          current === "available" ? (
            <span className="text-success">{slugMessages.available}</span>
          ) : (
            "Tus alumnos van a entrar por acá. Después no se puede cambiar fácil."
          )
        }
      >
        <div className="flex items-center overflow-hidden rounded-xl border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
          <input
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className="h-12 min-w-0 flex-1 bg-transparent pl-4 text-base outline-none"
            placeholder="tango-sur"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-invalid={Boolean(slugError)}
          />
          <span className="shrink-0 pr-4 text-base text-muted">.{rootDomain}</span>
        </div>
      </Field>

      <FormMessage ok={false} message={state.message} />
      <Button type="submit" disabled={pending || current === "taken" || current === "reserved"}>
        {pending ? "Creando tu estudio…" : "Crear estudio"}
      </Button>
      <p className="text-center text-xs text-muted">
        Al crear tu estudio aceptás los{" "}
        <a href={marketingUrl("/terminos")} target="_blank" rel="noopener noreferrer" className="underline">
          Términos de uso
        </a>
        , las{" "}
        <a href={marketingUrl("/condiciones")} target="_blank" rel="noopener noreferrer" className="underline">
          Condiciones de contratación
        </a>{" "}
        y la{" "}
        <a href={marketingUrl("/privacidad")} target="_blank" rel="noopener noreferrer" className="underline">
          Política de privacidad
        </a>
        .
      </p>
    </ActionForm>
  );
}
