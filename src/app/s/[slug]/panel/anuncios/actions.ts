"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";
import { startOfDay, addDaysYmd, isYmd } from "@/lib/datetime";

const schema = z.object({
  title: z.string().trim().min(2, "Poné un título.").max(120, "Usá un título más corto."),
  body: z.string().trim().min(2, "Escribí el mensaje.").max(2000, "El mensaje es muy largo (hasta 2000 caracteres)."),
  audience: z.enum(["all", "offering", "formation"]),
  offeringId: z.union([z.uuid(), z.literal("")]).optional(),
  formationId: z.union([z.uuid(), z.literal("")]).optional(),
  visibleUntil: z.string().optional(),
  sendEmail: z.literal("on").optional(),
});

export async function publishAnnouncement(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug, "/panel/anuncios");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const d = parsed.data;
  if (d.audience === "offering" && !d.offeringId) return { ok: false, fieldErrors: { offeringId: "Elegí la clase." } };
  if (d.audience === "formation" && !d.formationId) return { ok: false, fieldErrors: { formationId: "Elegí la formación." } };
  if (d.visibleUntil && !isYmd(d.visibleUntil)) return { ok: false, fieldErrors: { visibleUntil: "Elegí una fecha válida." } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_announcement", {
    p_studio_id: studio.id,
    p_title: d.title,
    p_body: d.body,
    p_audience: d.audience,
    p_offering_id: d.audience === "offering" ? d.offeringId || undefined : undefined,
    p_formation_id: d.audience === "formation" ? d.formationId || undefined : undefined,
    // "Hasta el 12/10" = se ve todo ese día (hasta la medianoche del estudio).
    p_visible_until: d.visibleUntil ? startOfDay(addDaysYmd(d.visibleUntil, 1), studio.timezone).toISOString() : undefined,
    p_send_email: d.sendEmail === "on",
  });
  if (error) return fromSupabaseError(error, "publishAnnouncement");

  const emailed = (data as { emailed?: number } | null)?.emailed ?? 0;
  revalidatePath(`/s/${slug}/panel/anuncios`);
  revalidatePath(`/s/${slug}/app`, "layout");
  return {
    ok: true,
    message: emailed ? `¡Publicado! Le llega por mail a ${emailed} ${emailed === 1 ? "alumno" : "alumnos"}.` : "¡Publicado! Ya lo ven en la app.",
  };
}

export async function deleteAnnouncement(slug: string, id: string): Promise<ActionState> {
  await requireAdmin(slug, "/panel/anuncios");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "No encontramos ese anuncio." };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return fromSupabaseError(error, "deleteAnnouncement");
  revalidatePath(`/s/${slug}/panel/anuncios`);
  revalidatePath(`/s/${slug}/app`, "layout");
  return { ok: true, message: "Anuncio borrado." };
}
