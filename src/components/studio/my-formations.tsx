import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AUDITION_STATUS_LABEL, ENROLLMENT_STATUS_LABEL } from "@/lib/formations";

/** Formaciones del alumno (postulaciones e inscripciones) en el inicio de la app. */
export async function MyFormations({ studentId }: { studentId: string }) {
  const supabase = await createClient();
  const [{ data }, { data: auditions }] = await Promise.all([
    supabase
      .from("formation_enrollments")
      .select("id, status, formation_id, formations(title)")
      .eq("student_id", studentId)
      .neq("status", "withdrawn")
      .order("applied_at", { ascending: false }),
    supabase
      .from("audition_applications")
      .select("id, status, formation_id, auditions(title)")
      .eq("student_id", studentId)
      .in("status", ["submitted", "waitlisted", "rejected", "pending_payment"])
      .order("created_at", { ascending: false }),
  ]);
  // Si ya entró a la formación, la audición no se muestra aparte.
  const inFormation = new Set((data ?? []).map((e) => e.formation_id));
  const pendingAuditions = (auditions ?? []).filter((a) => !inFormation.has(a.formation_id));
  if (!data?.length && !pendingAuditions.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Tus formaciones</h2>
      <ul className="space-y-2">
        {pendingAuditions.map((a) => (
          <li key={a.id}>
            <Link href={`/app/audiciones/${a.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.auditions?.title}</span>
                <span className="block text-sm text-muted">Audición · {AUDITION_STATUS_LABEL[a.status]}</span>
              </span>
              <span className="shrink-0 text-sm font-medium text-brand">Ver →</span>
            </Link>
          </li>
        ))}
        {(data ?? []).map((e) => (
          <li key={e.id}>
            <Link href={`/app/formaciones/${e.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="min-w-0">
                <span className="block truncate font-medium">{e.formations?.title}</span>
                <span className="block text-sm text-muted">{ENROLLMENT_STATUS_LABEL[e.status]}</span>
              </span>
              <span className="shrink-0 text-sm font-medium text-brand">Ver →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
