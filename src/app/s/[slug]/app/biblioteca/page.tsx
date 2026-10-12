import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireStudent } from "@/lib/student-app";
import { can } from "@/lib/gating";
import { listLibrary } from "@/lib/library.server";
import { MaterialList } from "@/components/formations/material-list";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function StudentLibraryPage({ params }: PageProps<"/s/[slug]/app/biblioteca">) {
  const { slug } = await params;
  const { studio } = await requireStudent(slug, "/app/biblioteca");
  if (!(await can(studio.id, "library"))) notFound();
  // RLS: lo que es "solo con pack" aparece si el alumno tiene un pack vigente.
  const items = await listLibrary(studio.id);

  return (
    <div className="space-y-6">
      <Link href="/app/perfil" className="inline-flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Perfil
      </Link>
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Biblioteca</h1>
        <p className="text-sm text-muted">Material que {studio.name} comparte con sus alumnos.</p>
      </div>
      <MaterialList materials={items} sessions={[]} generalLabel="Material" empty="Todavía no hay material para vos." />
    </div>
  );
}
