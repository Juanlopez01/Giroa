"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión y vuelve a la página pública del estudio. */
export async function signOutFromStudio() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
