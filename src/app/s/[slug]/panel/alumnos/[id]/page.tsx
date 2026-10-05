import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { studioOffersFeature } from "@/lib/packs.server";
import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";
import { FormMessage } from "@/components/ui/field";
import { setStudentActive, updateStudent } from "../actions";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Alumno" };

const BOOKING_STATUS = {
  booked: "Reservada",
  attended: "Vino",
  cancelled: "Canceló",
  no_show: "No vino",
} as const;

function shortDate(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d}/${m}`;
}

export default async function StudentPage({ params, searchParams }: PageProps<"/s/[slug]/panel/alumnos/[id]">) {
  const { slug, id } = await params;
  const isNew = (await searchParams).nuevo === "1";
  if (!z.uuid().safeParse(id).success) notFound();

  const { studio } = await requireStaff(slug, `/panel/alumnos/${id}`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: student }, { data: balances }, { data: bookings }, askRole] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase
      .from("student_balances")
      .select("*")
      .eq("studio_id", studio.id)
      .or(`student_id.eq.${id},partner_student_id.eq.${id}`)
      .order("expires_at", { ascending: false })
      .limit(20),
    supabase
      .from("bookings")
      .select("id, status, dance_role, sessions(starts_at, offerings(title))")
      .eq("studio_id", studio.id)
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
    studioOffersFeature(studio.id, "role_balance"),
  ]);
  if (!student) notFound();

  const usable = (balances ?? []).filter((b) => b.is_usable);
  const past = (balances ?? []).filter((b) => !b.is_usable);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-1">
        <Link href="/panel/alumnos" className="text-sm text-muted hover:text-foreground">
          ← Alumnos
        </Link>
        <h1 className="text-2xl font-semibold">{student.full_name}</h1>
        <p className="text-sm text-muted">
          {student.user_id ? "Usa la app" : student.email ? "Todavía no entró a la app" : "Sin email: no puede usar la app"}
          {student.is_active ? "" : " · Inactivo"}
        </p>
      </div>

      {isNew ? <FormMessage ok message="¡Alumno cargado! Cuando registres un pago, le aparece el saldo." /> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saldo</h2>
        {usable.length === 0 ? (
          <p className="text-muted">No tiene clases disponibles.</p>
        ) : (
          <ul className="space-y-2">
            {usable.map((b) => (
              <li key={b.student_pack_id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-sm text-muted">
                    Vence el {b.expires_on ? shortDate(b.expires_on) : "—"}
                    {b.partner_student_id ? " · compartido en pareja" : ""}
                  </p>
                </div>
                <p className="text-right font-semibold">
                  {b.credits_remaining === null ? "Libre" : `${b.credits_remaining} de ${b.credits_total}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Packs anteriores ({past.length})</summary>
            <ul className="mt-2 space-y-1 text-muted">
              {past.map((b) => (
                <li key={b.student_pack_id}>
                  {b.name} · {b.status === "expired" ? "venció" : b.status === "cancelled" ? "anulado" : "agotado"} el{" "}
                  {b.expires_on ? shortDate(b.expires_on) : "—"} · usó {b.credits_used}
                  {b.credits_total !== null ? ` de ${b.credits_total}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Últimas clases</h2>
        {!bookings?.length ? (
          <p className="text-muted">Todavía no reservó clases.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {bookings.map((b) => {
              const startsAt = b.sessions?.starts_at;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.sessions?.offerings?.title ?? "Clase"}</p>
                    <p className="text-muted">
                      {startsAt ? `${formatDayLabel(toYmd(new Date(startsAt), tz))} ${formatTime(startsAt, tz)}` : ""}
                      {b.dance_role ? ` · ${ROLE_LABELS[b.dance_role]}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-muted">{BOOKING_STATUS[b.status]}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Datos</h2>
        <StudentForm
          action={updateStudent.bind(null, slug, student.id)}
          askRole={askRole || student.default_role !== null}
          submitLabel="Guardar cambios"
          initial={{
            fullName: student.full_name,
            email: student.email ?? "",
            phone: student.phone ?? "",
            defaultRole: student.default_role ?? "",
          }}
        />
      </section>

      <section className="space-y-2 border-t border-border pt-6">
        <form action={setStudentActive.bind(null, slug, student.id, !student.is_active)}>
          <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
            {student.is_active ? "Marcar como inactivo" : "Reactivar alumno"}
          </button>
        </form>
        <p className="text-sm text-muted">
          {student.is_active
            ? "Inactivo no puede reservar ni comprar. Su historial se conserva."
            : "Vuelve a poder reservar y comprar."}
        </p>
      </section>
    </div>
  );
}
