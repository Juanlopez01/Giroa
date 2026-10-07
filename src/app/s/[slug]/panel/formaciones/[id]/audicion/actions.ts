"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { addDaysYmd, isYmd, startOfDay, zonedDateTime } from "@/lib/datetime";
import { parseArsToCents } from "@/lib/money";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const refresh = (slug: string) => revalidatePath(`/s/${slug}`, "layout");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Poné la hora." });

const auditionSchema = z.object({
  title: z.string().trim().min(2, { error: "Poné un título." }).max(120),
  description: z.string().trim().max(6000).transform((v) => (v === "" ? null : v)),
  closesOn: z.union([z.literal(""), z.string().refine(isYmd, { error: "Elegí una fecha válida." })]).transform((v) => (v === "" ? null : v)),
  fee: z.string().transform((v, ctx) => {
    const t = v.trim();
    if (t === "" || t === "0") return 0;
    const c = parseArsToCents(t);
    if (c === null || c < 0) {
      ctx.addIssue({ code: "custom", message: "Poné el arancel en pesos (0 si es gratis)." });
      return z.NEVER;
    }
    return c;
  }),
  videoMode: z.enum(["none", "optional", "required"]),
  usesSlots: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function saveAudition(
  slug: string,
  formationId: string,
  auditionId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = auditionSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    closesOn: formData.get("closesOn") ?? "",
    fee: formData.get("fee") ?? "",
    videoMode: formData.get("videoMode"),
    usesSlots: formData.get("usesSlots"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const a = parsed.data;
  const row = {
    title: a.title,
    description: a.description,
    // "Cierra el 30/11" = hasta el final de ese día, hora del estudio.
    closes_at: a.closesOn ? startOfDay(addDaysYmd(a.closesOn, 1), studio.timezone).toISOString() : null,
    fee_cents: a.fee,
    video_mode: a.videoMode,
    uses_slots: a.usesSlots,
  };
  const supabase = await createClient();
  const { error } = auditionId
    ? await supabase.from("auditions").update(row).eq("id", auditionId).eq("studio_id", studio.id)
    : await supabase.from("auditions").insert({ ...row, studio_id: studio.id, formation_id: formationId });
  if (error) return fromSupabaseError(error, "saveAudition");
  // La formación pasa a requerir aprobación: la audición es el filtro.
  await supabase.from("formations").update({ requires_approval: true }).eq("id", formationId).eq("studio_id", studio.id);
  refresh(slug);
  return { ok: true, message: auditionId ? "Guardamos los cambios." : "¡Audición creada! Armá el formulario y abrila." };
}

export async function setAuditionStatus(slug: string, auditionId: string, status: "open" | "closed" | "draft"): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("auditions").update({ status }).eq("id", auditionId).eq("studio_id", studio.id);
  if (error?.code === "23505") return { ok: false, message: "Ya hay otra audición abierta para esta formación." };
  if (error) return fromSupabaseError(error, "setAuditionStatus");
  refresh(slug);
  return { ok: true, message: status === "open" ? "¡Abierta! Ya se pueden inscribir." : status === "closed" ? "Cerraste la inscripción." : "Guardado." };
}

const fieldSchema = z.object({
  label: z.string().trim().min(2, { error: "Escribí la pregunta." }).max(200),
  kind: z.enum(["short_text", "long_text", "choice", "yes_no"]),
  options: z.string().trim().max(1000),
  required: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function addAuditionField(slug: string, auditionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = fieldSchema.safeParse({
    label: formData.get("label"),
    kind: formData.get("kind"),
    options: formData.get("options") ?? "",
    required: formData.get("required"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const f = parsed.data;
  const options = f.kind === "choice" ? f.options.split(/[,\n]/).map((o) => o.trim()).filter(Boolean).slice(0, 12) : [];
  if (f.kind === "choice" && options.length < 2) return { ok: false, fieldErrors: { options: "Poné al menos 2 opciones separadas por coma." } };

  const supabase = await createClient();
  const { count } = await supabase.from("audition_fields").select("id", { count: "exact", head: true }).eq("audition_id", auditionId);
  const { error } = await supabase.from("audition_fields").insert({
    studio_id: studio.id,
    audition_id: auditionId,
    label: f.label,
    kind: f.kind,
    options,
    required: f.required,
    sort: (count ?? 0) + 1,
  });
  if (error) return fromSupabaseError(error, "addAuditionField");
  refresh(slug);
  return { ok: true, message: "Agregamos la pregunta." };
}

export async function removeAuditionField(slug: string, fieldId: string): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("audition_fields").delete().eq("id", fieldId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "removeAuditionField");
  refresh(slug);
  return { ok: true, message: "Pregunta borrada." };
}

const slotsSchema = z.object({
  date: z.string().refine(isYmd, { error: "Elegí la fecha." }),
  from: hhmm,
  to: hhmm,
  every: z.coerce.number().int().min(5, { error: "Mínimo 5 minutos." }).max(240),
  capacity: z.coerce.number().int().min(1).max(100),
});

/** Genera turnos en una franja: "sábado de 10 a 13, cada 20 minutos". */
export async function addAuditionSlots(slug: string, auditionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const parsed = slotsSchema.safeParse({
    date: formData.get("date"),
    from: formData.get("from"),
    to: formData.get("to"),
    every: formData.get("every"),
    capacity: formData.get("capacity") || 1,
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const s = parsed.data;
  const start = zonedDateTime(s.date, s.from, studio.timezone).getTime();
  const end = zonedDateTime(s.date, s.to, studio.timezone).getTime();
  if (end <= start) return { ok: false, fieldErrors: { to: "Tiene que terminar después de empezar." } };
  const rows = [];
  for (let t = start; t + s.every * 60_000 <= end && rows.length < 60; t += s.every * 60_000) {
    rows.push({
      studio_id: studio.id,
      audition_id: auditionId,
      starts_at: new Date(t).toISOString(),
      ends_at: new Date(t + s.every * 60_000).toISOString(),
      capacity: s.capacity,
    });
  }
  if (!rows.length) return { ok: false, fieldErrors: { every: "No entra ningún turno en esa franja." } };
  const supabase = await createClient();
  const { error } = await supabase.from("audition_slots").upsert(rows, { onConflict: "audition_id,starts_at", ignoreDuplicates: true });
  if (error) return fromSupabaseError(error, "addAuditionSlots");
  refresh(slug);
  return { ok: true, message: `Agregamos ${rows.length} ${rows.length === 1 ? "turno" : "turnos"}.` };
}

export async function removeAuditionSlot(slug: string, slotId: string): Promise<ActionState> {
  const { studio } = await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("audition_slots").delete().eq("id", slotId).eq("studio_id", studio.id);
  if (error) return fromSupabaseError(error, "removeAuditionSlot");
  refresh(slug);
  return { ok: true, message: "Turno borrado." };
}

// --------------------------------------------------------------- aspirantes

export async function setAuditionResult(slug: string, applicationId: string, result: "admitted" | "waitlisted" | "rejected"): Promise<ActionState> {
  await requireAdmin(slug);
  if (!z.uuid().safeParse(applicationId).success) return { ok: false, message: "No encontramos esa inscripción." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_audition_result", { p_application_id: applicationId, p_result: result });
  if (error) return fromSupabaseError(error, "setAuditionResult");
  refresh(slug);
  return {
    ok: true,
    message:
      result === "admitted"
        ? "Admitido/a: le mandamos el link de la matrícula."
        : result === "waitlisted"
          ? "En lista de espera. Le avisamos."
          : "No admitido/a. Le avisamos.",
  };
}

export async function recordAuditionPayment(slug: string, applicationId: string, method: "cash" | "transfer"): Promise<ActionState> {
  await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_audition_payment", { p_application_id: applicationId, p_method: method });
  if (error) return fromSupabaseError(error, "recordAuditionPayment");
  refresh(slug);
  return { ok: true, message: "Arancel registrado." };
}

export async function cancelAuditionApplication(slug: string, applicationId: string): Promise<ActionState> {
  await requireAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_audition_application", { p_application_id: applicationId });
  if (error) return fromSupabaseError(error, "cancelAuditionApplication");
  refresh(slug);
  return { ok: true, message: "Inscripción cancelada. El turno quedó libre." };
}
