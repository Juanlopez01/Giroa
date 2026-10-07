import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ENROLLMENT_STATUS_LABEL } from "@/lib/formations";

/** Formaciones del alumno (postulaciones e inscripciones) en el inicio de la app. */
export async function MyFormations({ studentId }: { studentId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("formation_enrollments")
    .select("id, status, formations(title)")
    .eq("student_id", studentId)
    .neq("status", "withdrawn")
    .order("applied_at", { ascending: false });
  if (!data?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Tus formaciones</h2>
      <ul className="space-y-2">
        {data.map((e) => (
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
