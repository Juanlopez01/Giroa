import type { Metadata } from "next";
import { listTeamOptions } from "@/lib/studio.server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { listDisciplines } from "@/lib/disciplines.server";
import { can } from "@/lib/gating";
import { trimTime, WEEKDAYS } from "@/lib/datetime";
import { FormMessage } from "@/components/ui/field";
import { addSchedule, removeSchedule, setOfferingActive, updateOffering } from "../actions";
import { OfferingForm } from "../offering-form";
import { AddScheduleForm, RemoveScheduleButton } from "./schedules";

export const metadata: Metadata = { title: "Clase" };

export default async function OfferingPage({ params, searchParams }: PageProps<"/s/[slug]/panel/clases/[id]">) {
  const { slug, id } = await params;
  const isNew = (await searchParams).nueva === "1";
  if (!z.uuid().safeParse(id).success) notFound();

  const { studio, isAdmin } = await requireStaff(slug, `/panel/clases/${id}`);
  const supabase = await createClient();

  const [{ data: offering }, disciplines, allowRoleBalance, teachers] = await Promise.all([
    supabase
      .from("offerings")
      .select("*, disciplines(name), class_schedules(id, weekday, start_time, duration_minutes, is_active)")
      .eq("id", id)
      .eq("studio_id", studio.id)
      .maybeSingle(),
    listDisciplines(),
    can(studio.id, "role_balance"),
    listTeamOptions(studio.id),
  ]);
  if (!offering) notFound();

  const schedules = [...offering.class_schedules].sort(
    (a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.start_time.localeCompare(b.start_time),
  );

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-1">
        <Link href="/panel/clases" className="text-sm text-muted hover:text-foreground">
          ← Clases
        </Link>
        <h1 className="text-2xl font-semibold">{offering.title}</h1>
        <p className="text-muted">
          {offering.disciplines?.name}
          {offering.is_active ? "" : " · Pausada"}
        </p>
      </div>

      {isNew ? <FormMessage ok message="¡Clase creada! Ahora cargale los horarios de la semana." /> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Horarios</h2>
        {schedules.length === 0 ? (
          <p className="text-muted">Sin horarios todavía.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {schedules.map((s) => {
              const label = `${WEEKDAYS[s.weekday]} ${trimTime(s.start_time)}`;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted">{s.duration_minutes} minutos</p>
                  </div>
                  {isAdmin ? <RemoveScheduleButton label={label} remove={removeSchedule.bind(null, slug, s.id)} /> : null}
                </li>
              );
            })}
          </ul>
        )}
        {isAdmin ? <AddScheduleForm action={addSchedule.bind(null, slug, offering.id)} /> : null}
      </section>

      {isAdmin ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Datos de la clase</h2>
            <OfferingForm
              action={updateOffering.bind(null, slug, offering.id)}
              disciplines={disciplines}
              submitLabel="Guardar cambios"
              allowRoleBalance={allowRoleBalance}
              teachers={teachers.length > 1 || offering.teacher_member_id ? teachers : []}
              initial={{
                title: offering.title,
                disciplineKey: offering.discipline_key,
                level: offering.level ?? "",
                teacherName: offering.teacher_name ?? "",
                teacherMemberId: offering.teacher_member_id ?? "",
                description: offering.description ?? "",
                capacity: offering.capacity,
                roleBalanceMaxDiff: offering.role_balance_max_diff,
              }}
            />
          </section>

          <section className="space-y-2 border-t border-border pt-6">
            <form action={setOfferingActive.bind(null, slug, offering.id, !offering.is_active)}>
              <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
                {offering.is_active ? "Pausar esta clase" : "Reactivar esta clase"}
              </button>
            </form>
            <p className="text-sm text-muted">
              {offering.is_active
                ? "Pausada no aparece en la grilla ni se generan clases nuevas. Las reservas que ya existen se mantienen."
                : "Al reactivarla vuelve a la grilla; generá las próximas clases desde la agenda."}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
