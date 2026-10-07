import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logoUrl } from "@/lib/studio";
import { studioUrl } from "@/lib/urls";
import { StudioBrandForm } from "@/components/brand/studio-brand-form";
import { saveBrand } from "@/lib/brand.actions";

export const metadata: Metadata = { title: "La marca de tu estudio" };

export default async function BrandPage({ searchParams }: PageProps<"/onboarding/marca">) {
  const params = await searchParams;
  const studioId = z.uuid().safeParse(params.estudio);
  if (!studioId.success) redirect("/estudios");

  const user = await requireUser(`/onboarding/marca?estudio=${studioId.data}`);
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("studio_members")
    .select("role, studios(id, name, slug, brand_color, logo_path, cover_path)")
    .eq("studio_id", studioId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  const studio = membership?.studios;
  if (!membership || !studio || (membership.role !== "owner" && membership.role !== "admin")) {
    redirect("/estudios");
  }

  return (
    <div className="space-y-8 pt-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted">Paso 2 de 2</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Dale tu marca</h1>
        <p className="text-muted">Así ven tu estudio los alumnos en la app. Lo podés cambiar cuando quieras.</p>
      </div>
      <StudioBrandForm
        action={saveBrand.bind(null, "onboarding")}
        studioId={studio.id}
        studioName={studio.name}
        initialColor={studio.brand_color}
        initialLogoUrl={logoUrl(studio.logo_path)}
        initialCoverUrl={logoUrl(studio.cover_path)}
        submitLabel="Guardar y entrar al panel"
        skipHref={studioUrl(studio.slug, "/panel")}
      />
    </div>
  );
}
