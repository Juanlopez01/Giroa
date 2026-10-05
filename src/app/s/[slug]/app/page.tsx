import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserOnStudio } from "@/lib/auth";
import { getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";
import { StudioHeader } from "@/components/studio/studio-header";
import { FormMessage } from "@/components/ui/field";

export const metadata: Metadata = { title: "Mi cuenta" };

// Provisorio: la app del alumno (reservar, cancelar, QR) llega en el paso 7.
export default async function StudentHomePage({ params, searchParams }: PageProps<"/s/[slug]/app">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  const user = await requireUserOnStudio("/app");
  const student = await getMyStudent(studio.id, user.id);
  if (!student) redirect("/sumate");

  const welcome = (await searchParams).bienvenida === "1";
  const supabase = await createClient();
  const { data: balances } = await supabase
    .from("student_balances")
    .select("student_pack_id, name, credits_remaining, expires_on")
    .eq("studio_id", studio.id)
    // Explícito: si además es staff, RLS le dejaría ver el saldo de todos.
    .or(`student_id.eq.${student.id},partner_student_id.eq.${student.id}`)
    .eq("is_usable", true)
    .order("expires_at");

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-8">
        {welcome ? <FormMessage ok message={`¡Listo, ${student.full_name.split(" ")[0]}! Ya sos parte de ${studio.name}.`} /> : null}
        <h1 className="text-2xl font-semibold">Hola, {student.full_name.split(" ")[0]}</h1>
        <section className="space-y-2">
          <h2 className="font-semibold">Tu saldo</h2>
          {balances?.length ? (
            balances.map((b) => {
              const [, m, d] = (b.expires_on ?? "").split("-").map(Number);
              return (
                <p key={b.student_pack_id} className="rounded-2xl border border-border bg-surface p-4">
                  {b.credits_remaining === null
                    ? "Clases libres"
                    : `Te quedan ${b.credits_remaining} ${b.credits_remaining === 1 ? "clase" : "clases"}`}
                  {b.expires_on ? `, vence el ${d}/${m}` : ""}.
                </p>
              );
            })
          ) : (
            <p className="text-muted">Todavía no tenés clases disponibles.</p>
          )}
        </section>
        <Link href="/" className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-medium text-brand-foreground">
          Ver las clases
        </Link>
      </main>
    </div>
  );
}
