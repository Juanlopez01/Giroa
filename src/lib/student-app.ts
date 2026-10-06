import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUserOnStudio, type CurrentUser } from "@/lib/auth";
import { getMyStudent, getStudioBySlug, type PublicStudio } from "@/lib/studio.server";

export type StudentContext = {
  studio: PublicStudio;
  user: CurrentUser;
  student: NonNullable<Awaited<ReturnType<typeof getMyStudent>>>;
};

/** Guardia de la app del alumno: estudio + sesión + ficha de alumno. */
export async function requireStudent(slug: string, path: string): Promise<StudentContext> {
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();
  const user = await requireUserOnStudio(path);
  const student = await getMyStudent(studio.id, user.id);
  if (!student) redirect("/sumate");
  return { studio, user, student };
}
