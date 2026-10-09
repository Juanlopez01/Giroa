"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { cancelMembershipFor } from "@/lib/memberships.server";
import type { ActionState } from "@/lib/errors";

export async function cancelStudentMembership(slug: string, subscriptionId: string): Promise<ActionState> {
  const { studio } = await requireAdmin(slug, "/panel/pagos/abonos");
  if (!z.uuid().safeParse(subscriptionId).success) return { ok: false, message: "No encontramos ese abono." };
  const result = await cancelMembershipFor(studio.id, subscriptionId);
  revalidatePath(`/s/${slug}/panel/pagos/abonos`);
  return result.ok ? { ok: true, message: "Dado de baja. No se le va a volver a cobrar." } : result;
}
