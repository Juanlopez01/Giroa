"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrorsFromZod, type ActionState } from "@/lib/errors";
import { emailEnv } from "@/lib/env.server";
import { sendWithResend } from "@/lib/email/send";
import { founderLeadEmail } from "@/lib/email/templates";

/** A dónde llegan los contactos del formulario de fundadores. */
const LEADS_TO = process.env.LEADS_EMAIL || "juanldevelop@gmail.com";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const leadSchema = z.object({
  name: z.string().trim().min(2, { error: "Contanos tu nombre." }).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Revisá el email." })),
  phone: z.preprocess(blank, z.string().trim().max(40).nullable()),
  kind: z.enum(["studio", "teacher"], { error: "Elegí si sos estudio o profe." }),
  studioName: z.preprocess(blank, z.string().trim().max(120).nullable()),
  disciplines: z.preprocess(blank, z.string().trim().max(200).nullable()),
  studentsCount: z.preprocess(blank, z.string().trim().max(40).nullable()),
  message: z.preprocess(blank, z.string().trim().max(2000).nullable()),
});

export async function submitFounderLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Campo trampa: los bots lo completan, las personas no lo ven.
  if (String(formData.get("website") ?? "") !== "") return { ok: true, message: "¡Gracias! Te escribimos pronto." };

  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    kind: formData.get("kind"),
    studioName: formData.get("studioName"),
    disciplines: formData.get("disciplines"),
    studentsCount: formData.get("studentsCount"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) };
  const l = parsed.data;

  const { error } = await createAdminClient().from("founder_leads").insert({
    name: l.name,
    email: l.email,
    phone: l.phone,
    kind: l.kind,
    studio_name: l.studioName,
    disciplines: l.disciplines,
    students_count: l.studentsCount,
    message: l.message,
  });
  if (error) {
    console.error("[submitFounderLead]", error);
    return { ok: false, message: "No pudimos enviar el formulario. Probá de nuevo en un rato." };
  }

  // Aviso por mail (si falla, el contacto igual quedó guardado en founder_leads).
  const mail = emailEnv();
  if (mail) {
    try {
      await sendWithResend(mail.RESEND_API_KEY, {
        from: `Giroa <${mail.EMAIL_FROM_ADDRESS}>`,
        to: LEADS_TO,
        reply_to: l.email,
        ...founderLeadEmail(l),
      });
    } catch (e) {
      console.error("[submitFounderLead.mail]", e);
    }
  } else {
    console.warn("[submitFounderLead] sin RESEND_API_KEY: el contacto quedó solo en founder_leads");
  }
  return { ok: true, message: `¡Gracias, ${l.name.split(" ")[0]}! Te escribimos en las próximas 24 horas.` };
}
