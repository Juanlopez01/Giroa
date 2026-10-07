import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, toYmd } from "@/lib/datetime";
import { QrScanner } from "@/components/panel/qr-scanner";
import { markFormationPresent, scanFormationQr } from "../../../actions";
import { ActionButtons } from "../../inscriptos/enrollment-controls";

export const metadata: Metadata = { title: "Asistencia" };

// Asistencia de un encuentro de la formación: QR del alumno o a mano.
export default async function FormationSessionPage({ params }: PageProps<"/s/[slug]/panel/formaciones/[id]/encuentros/[sessionId]">) {
  const { slug, id, sessionId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(sessionId).success) notFound();
  const { studio } = await requireStaff(slug, `/panel/formaciones/${id}/encuentros/${sessionId}`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: s }, { data: enrollments }, { data: attendance }] = await Promise.all([
    supabase.from("formation_sessions").select("*, formations(title)").eq("id", sessionId).eq("formation_id", id).maybeSingle(),
    supabase
      .from("formation_enrollments")
      .select("id, students!formation_enrollments_studio_id_student_id_fkey(full_name)")
      .eq("formation_id", id)
      .eq("status", "enrolled"),
    supabase.from("formation_attendance").select("enrollment_id, checked_in_at").eq("formation_session_id", sessionId),
  ]);
  if (!s) notFound();
  const present = new Map((attendance ?? []).map((a) => [a.enrollment_id, a.checked_in_at]));
  const list = [...(enrollments ?? [])].sort((a, b) => (a.students?.full_name ?? "").localeCompare(b.students?.full_name ?? ""));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href={`/panel/formaciones/${id}`} className="text-sm text-muted hover:text-foreground">
          ← {s.formations?.title}
        </Link>
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <p className="text-muted">
          {formatDayLabel(toYmd(new Date(s.starts_at), tz))} · {formatTime(s.starts_at, tz)} a {formatTime(s.ends_at, tz)}
        </p>
        <p className="text-sm">
          <span className="font-medium">{present.size}</span> de {list.length} presentes
        </p>
      </div>

      <QrScanner scan={scanFormationQr.bind(null, slug, sessionId)} hint="Apuntá al QR del alumno (el de su app)." />

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {list.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="truncate font-medium">{e.students?.full_name}</p>
            {present.has(e.id) ? (
              <span className="text-sm font-medium text-success">Presente {formatTime(present.get(e.id)!, tz)}</span>
            ) : (
              <ActionButtons buttons={[{ label: "Presente", run: markFormationPresent.bind(null, slug, sessionId, e.id) }]} />
            )}
          </li>
        ))}
        {!list.length ? <li className="px-4 py-3 text-muted">Todavía no hay inscriptos.</li> : null}
      </ul>
    </div>
  );
}
