"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { parseFeatures } from "@/lib/disciplines";
import { parseArsToCents } from "@/lib/money";
import { isYmd, nowMs, todayYmd, zonedDateTime } from "@/lib/datetime";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
const schema = z.object({
  title: z.string().trim().min(2, "Poné un nombre (por ejemplo, “Workshop de giros”).").max(120, "Usá un nombre más corto."),
  disciplineKey: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Elegí una disciplina."),
  description: z.string().trim().max(4000, "La descripción es muy larga.").optional(),
  teacherName: z.string().trim().max(120, "El nombre del profe es muy largo.").optional(),
  date: z.string().refine(isYmd, "Elegí la fecha."),
  start: z.string().regex(hhmm, "Poné la hora de inicio."),
  end: z.string().regex(hhmm, "Poné la hora de fin."),
  capacity: z.coerce.number({ error: "Poné el cupo." }).int().min(1, "El cupo es de al menos 1.").max(1000),
  price: z.string().transform((v, ctx) => {
    const cents = parseArsToCents(v);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Poné el precio en pesos (por ejemplo 15.000)." });
      return z.NEVER;
    }
    return cents;
  }),
  packAllowed: z.literal("on").optional(),
});

/** Crea el workshop (una clase especial con precio) y su encuentro. */
export async function createWorkshop(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { studio } = await requireAdmin(slug, "/panel/workshops");
  if (!(await can(studio.id, "specials"))) return { ok: false, message: "Los workshops están en el plan Estudio." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const d = parsed.data;
  if (d.end <= d.start) return { ok: false, fieldErrors: { end: "La hora de fin tiene que ser después del inicio." } };
  const startsAt = zonedDateTime(d.date, d.start, studio.timezone);
  if (startsAt.getTime() <= nowMs() || d.date < todayYmd(studio.timezone)) {
    return { ok: false, fieldErrors: { date: "Elegí una fecha y hora futuras." } };
  }
  const endsAt = zonedDateTime(d.date, d.end, studio.timezone);

  const supabase = await createClient();
  const { data: discipline } = await supabase.from("disciplines").select("features").eq("key", d.disciplineKey).maybeSingle();
  if (!discipline) return { ok: false, fieldErrors: { disciplineKey: "Elegí una disciplina." } };
  const roleBalance = parseFeatures(discipline.features).role_balance && (await can(studio.id, "role_balance"));

  const { data: offering, error } = await supabase
    .from("offerings")
    .insert({
      studio_id: studio.id,
      kind: "special",
      title: d.title,
      discipline_key: d.disciplineKey,
      description: d.description || null,
      teacher_name: d.teacherName || null,
      capacity: d.capacity,
      price_cents: d.price,
      pack_allowed: d.packAllowed === "on",
      // En danzas de pareja, que no se desbalancee más de 2.
      role_balance_max_diff: roleBalance ? 2 : null,
    })
    .select("id")
    .single();
  if (error) return fromSupabaseError(error, "createWorkshop");

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ studio_id: studio.id, offering_id: offering.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() })
    .select("id")
    .single();
  if (sessionError) {
    await supabase.from("offerings").delete().eq("id", offering.id);
    return fromSupabaseError(sessionError, "createWorkshop");
  }

  redirect(`/panel/agenda/${session.id}?workshop=1`);
}
