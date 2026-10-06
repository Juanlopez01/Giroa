import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";
import { can } from "@/lib/gating";
import { checkInStudent, scanStudentQr } from "./actions";
import { MarkPresentButton, WalkInPicker } from "./attendance";
import { QrScanner } from "@/components/panel/qr-scanner";

export const metadata: Metadata = { title: "Asistencia" };

export default async function SessionPage({ params }: PageProps<"/s/[slug]/panel/agenda/[id]">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio } = await requireStaff(slug, `/panel/agenda/${id}`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: occ }, { data: bookings }, { data: students }] = await Promise.all([
    supabase.from("session_occupancy").select("*").eq("session_id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, status, dance_role, checked_in_at, students!bookings_studio_id_student_id_fkey(id, full_name)")
      .eq("studio_id", studio.id)
      .eq("session_id", id)
      .in("status", ["booked", "attended", "no_show"])
      .order("created_at"),
    supabase.from("students").select("id, full_name").eq("studio_id", studio.id).eq("is_active", true).order("full_name").limit(2000),
  ]);
  if (!occ?.session_id || !occ.starts_at || !occ.ends_at) notFound();

  const { data: offering } = await supabase.from("offerings").select("title").eq("id", occ.offering_id ?? "").maybeSingle();

  const startsMs = new Date(occ.starts_at).getTime();
  // Mismo margen que check_in: desde 2 h antes.
  const canCheckIn = occ.status === "scheduled" && nowMs() >= startsMs - 2 * 3_600_000;
  const qrAllowed = await can(studio.id, "qr_checkin");
  const list = bookings ?? [];
  const present = list.filter((b) => b.status === "attended").length;
  const bookedIds = new Set(list.map((b) => b.students?.id));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href="/panel/agenda" className="text-sm text-muted hover:text-foreground">
          ← Agenda
        </Link>
        <h1 className="text-2xl font-semibold">{offering?.title ?? "Clase"}</h1>
        <p className="text-muted">
          {formatDayLabel(toYmd(new Date(occ.starts_at), tz))} · {formatTime(occ.starts_at, tz)} a {formatTime(occ.ends_at, tz)}
        </p>
        <p className="text-sm">
          <span className="font-medium">{present}</span> {present === 1 ? "presente" : "presentes"} · {occ.booked_count}/{occ.capacity} anotados
          {(occ.leader_count ?? 0) + (occ.follower_count ?? 0) > 0
            ? ` · ${occ.leader_count} ${occ.leader_count === 1 ? "líder" : "líderes"} · ${occ.follower_count} ${occ.follower_count === 1 ? "seguidor/a" : "seguidores/as"}`
            : ""}
        </p>
      </div>

      {occ.status === "cancelled" ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">Esta clase está cancelada.</p>
      ) : canCheckIn ? (
        <section className="space-y-4">
          {qrAllowed ? <QrScanner scan={scanStudentQr.bind(null, slug, id)} hint="Apuntá al QR del alumno." /> : null}
          <WalkInPicker
            students={(students ?? []).filter((s) => !bookedIds.has(s.id)).map((s) => ({ id: s.id, name: s.full_name }))}
            mark={checkInStudent.bind(null, slug, id)}
          />
        </section>
      ) : (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
          La asistencia se toma desde 2 horas antes de la clase.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Anotados</h2>
        {list.length === 0 ? (
          <p className="text-muted">Todavía no hay nadie anotado.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {list.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.students?.full_name ?? "Alumno"}</p>
                  <p className="text-sm text-muted">{b.dance_role ? ROLE_LABELS[b.dance_role] : "Sin rol"}</p>
                </div>
                {b.status === "attended" ? (
                  <span className="text-sm font-medium text-success">
                    Presente{b.checked_in_at ? ` ${formatTime(b.checked_in_at, tz)}` : ""}
                  </span>
                ) : b.status === "no_show" ? (
                  <span className="text-sm text-muted">No vino</span>
                ) : canCheckIn && b.students ? (
                  <MarkPresentButton mark={checkInStudent.bind(null, slug, id, b.students.id)} />
                ) : (
                  <span className="text-sm text-muted">Reservó</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
