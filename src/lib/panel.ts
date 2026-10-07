import "server-only";
import { notFound } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { getMyMembership, getStudioBySlug, type PublicStudio } from "@/lib/studio.server";
import { studioUrl } from "@/lib/urls";

export type StaffContext = {
  studio: PublicStudio;
  user: CurrentUser;
  role: "owner" | "admin" | "teacher";
  /** Id en studio_members (para "Mis clases" del profe). */
  memberId: string;
  isAdmin: boolean;
  isOwner: boolean;
  /** Puede registrar pagos manuales (admin, o profe con el permiso). */
  canTakePayments: boolean;
};

/**
 * Guardia del panel: estudio existente + usuario logueado + staff del estudio.
 * Es para la UI; la seguridad real la ponen RLS y las RPC.
 */
export async function requireStaff(slug: string, path = "/panel"): Promise<StaffContext> {
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();
  const user = await requireUser(studioUrl(slug, path));
  const member = await getMyMembership(studio.id, user.id);
  const role = member?.role;
  // El layout del panel ya muestra un mensaje amable a quien no es staff.
  if (!role) notFound();
  const isAdmin = role === "owner" || role === "admin";
  return {
    studio,
    user,
    role,
    memberId: member.id,
    isAdmin,
    isOwner: role === "owner",
    canTakePayments: isAdmin || member.can_take_payments,
  };
}

/** Igual que requireStaff pero solo owner/admin (para acciones que escriben). */
export async function requireAdmin(slug: string, path = "/panel"): Promise<StaffContext> {
  const ctx = await requireStaff(slug, path);
  if (!ctx.isAdmin) notFound();
  return ctx;
}

/** Solo el dueño (suscripción y plan). */
export async function requireOwner(slug: string, path = "/panel"): Promise<StaffContext> {
  const ctx = await requireStaff(slug, path);
  if (!ctx.isOwner) notFound();
  return ctx;
}
