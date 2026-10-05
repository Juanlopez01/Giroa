import "server-only";
import { notFound } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { getMyStaffRole, getStudioBySlug, type PublicStudio } from "@/lib/studio.server";
import { studioUrl } from "@/lib/urls";

export type StaffContext = {
  studio: PublicStudio;
  user: CurrentUser;
  role: "owner" | "admin" | "teacher";
  isAdmin: boolean;
};

/**
 * Guardia del panel: estudio existente + usuario logueado + staff del estudio.
 * Es para la UI; la seguridad real la ponen RLS y las RPC.
 */
export async function requireStaff(slug: string, path = "/panel"): Promise<StaffContext> {
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();
  const user = await requireUser(studioUrl(slug, path));
  const role = await getMyStaffRole(studio.id, user.id);
  // El layout del panel ya muestra un mensaje amable a quien no es staff.
  if (!role) notFound();
  return { studio, user, role, isAdmin: role === "owner" || role === "admin" };
}

/** Igual que requireStaff pero solo owner/admin (para acciones que escriben). */
export async function requireAdmin(slug: string, path = "/panel"): Promise<StaffContext> {
  const ctx = await requireStaff(slug, path);
  if (!ctx.isAdmin) notFound();
  return ctx;
}
