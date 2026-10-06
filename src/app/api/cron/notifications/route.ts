import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailEnv, serverEnv } from "@/lib/env.server";
import { studioUrl } from "@/lib/urls";
import {
  classReminderEmail,
  eventTicketsEmail,
  packExpiringEmail,
  packGrantedEmail,
  sessionCancelledEmail,
  type EmailContent,
  type StudioInfo,
} from "@/lib/email/templates";

// Manda los avisos pendientes de la cola. Lo llama pg_cron (con pg_net) cada
// minuto si hay algo para mandar, con Authorization: Bearer CRON_SECRET.
export const maxDuration = 60;

type Claimed = {
  id: number;
  template: string;
  to_address: string;
  payload: Record<string, unknown>;
  studio_name: string;
  studio_slug: string;
  studio_timezone: string;
  student_name: string | null;
};

function authorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${serverEnv().CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const email = emailEnv();
  // Sin Resend configurado, los avisos esperan en la cola.
  if (!email) return NextResponse.json({ skipped: "RESEND_API_KEY no configurada" });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notifications", { p_limit: 50 });
  if (error) {
    console.error("[notifications] claim", error);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const n of (data ?? []) as Claimed[]) {
    let ok = false;
    let message: string | null = null;
    try {
      const content = await render(admin, n);
      if (!content) {
        // Plantilla sin datos (p. ej. la orden ya no existe): no se manda.
        await admin.rpc("finish_notification", { p_id: n.id, p_ok: true, p_error: undefined });
        continue;
      }
      await sendWithResend(email.RESEND_API_KEY, {
        from: `${n.studio_name.replace(/[<>"]/g, "")} vía Giroa <${email.EMAIL_FROM_ADDRESS}>`,
        to: n.to_address,
        ...content,
      });
      ok = true;
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
      console.error("[notifications] send", n.id, n.template, message);
    }
    await admin.rpc("finish_notification", { p_id: n.id, p_ok: ok, p_error: message ?? undefined });
    if (ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ sent, failed });
}

async function render(admin: ReturnType<typeof createAdminClient>, n: Claimed): Promise<EmailContent | null> {
  const studio: StudioInfo = {
    name: n.studio_name,
    timezone: n.studio_timezone,
    url: (path) => studioUrl(n.studio_slug, path),
  };
  const p = n.payload;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);

  switch (n.template) {
    case "event_tickets": {
      const { data: o } = await admin
        .from("event_orders")
        .select("buyer_name, quantity, access_token, status, events(title, starts_at, venue)")
        .eq("id", str("order_id") ?? "")
        .maybeSingle();
      if (!o || o.status !== "paid" || !o.events) return null;
      return eventTicketsEmail(studio, o.buyer_name, {
        eventTitle: o.events.title,
        startsAt: o.events.starts_at,
        venue: o.events.venue,
        quantity: o.quantity,
        accessToken: o.access_token,
      });
    }
    case "pack_granted":
      return packGrantedEmail(studio, n.student_name, {
        name: str("name") ?? "de clases",
        credits: num("credits"),
        expiresAt: str("expires_at") ?? new Date().toISOString(),
      });
    case "pack_expiring":
      return packExpiringEmail(studio, n.student_name, {
        name: str("name") ?? "de clases",
        creditsRemaining: num("credits_remaining"),
        expiresOn: str("expires_on") ?? "",
      });
    case "class_reminder": {
      const startsAt = str("starts_at");
      if (!startsAt || new Date(startsAt).getTime() < Date.now()) return null; // ya empezó
      return classReminderEmail(studio, n.student_name, { title: str("title") ?? "tu clase", startsAt });
    }
    case "session_cancelled": {
      const startsAt = str("starts_at");
      if (!startsAt) return null;
      return sessionCancelledEmail(studio, n.student_name, { title: str("title") ?? "tu clase", startsAt, reason: str("reason") });
    }
    default:
      return null;
  }
}

async function sendWithResend(
  apiKey: string,
  mail: { from: string; to: string; subject: string; html: string; text: string },
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(mail),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
