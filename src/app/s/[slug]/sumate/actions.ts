"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFromZod, fromSupabaseError, type ActionState } from "@/lib/errors";

const joinSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "Contanos tu nombre." })
    .max(120, { error: "El nombre puede tener hasta 120 caracteres." }),
  phone: z
    .string()
    .trim()
    .max(40, { error: "El teléfono es muy largo." })
    .transform((v) => (v === "" ? null : v)),
  role: z.preprocess((v) => (v === "" || v === null ? null : v), z.enum(["leader", "follower"]).nullable()),
});

export async function joinStudio(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { ok: false, message: "Tu sesión venció. Entrá de nuevo para seguir." };

  const parsed = joinSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role") ?? null,
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };

  // join_studio vincula la ficha que el estudio ya tenía con tu email, o crea una.
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_studio", {
    p_slug: slug,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone ?? undefined,
    p_role: parsed.data.role ?? undefined,
  });
  if (error) return fromSupabaseError(error, "joinStudio");

  redirect("/app?bienvenida=1");
}
