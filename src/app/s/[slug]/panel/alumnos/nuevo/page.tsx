import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { studioOffersFeature } from "@/lib/packs.server";
import { createStudent } from "../actions";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Nuevo alumno" };

export default async function NewStudentPage({ params }: PageProps<"/s/[slug]/panel/alumnos/nuevo">) {
  const { slug } = await params;
  const { studio } = await requireStaff(slug, "/panel/alumnos/nuevo");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href="/panel/alumnos" className="text-sm text-muted hover:text-foreground">
          ← Alumnos
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo alumno</h1>
      </div>
      <StudentForm
        action={createStudent.bind(null, slug)}
        askRole={await studioOffersFeature(studio.id, "role_balance")}
        submitLabel="Guardar alumno"
      />
    </div>
  );
}
