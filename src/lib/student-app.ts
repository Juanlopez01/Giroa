import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUserOnStudio, type CurrentUser } from "@/lib/auth";
import { fetchMyStudent, getMyStudent, getStudioBySlug, type PublicStudio } from "@/lib/studio.server";
import { createClient } from "@/lib/supabase/server";

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
  let student = await getMyStudent(studio.id, user.id);
  if (!student && (await linkFichaByEmail(studio.slug))) student = await fetchMyStudent(studio.id, user.id);
  if (!student) redirect("/sumate");
  return { studio, user, student };
}

/**
 * Si el estudio ya lo había cargado con este email (lo cobró en el mostrador o
 * lo dio de alta), al entrar por primera vez se vincula solo, sin pasar por
 * "Sumate". join_studio sin nombre vincula esa ficha y, si no hay, no crea nada.
 */
async function linkFichaByEmail(slug: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_studio", { p_slug: slug, p_full_name: "" });
  return !error;
}
