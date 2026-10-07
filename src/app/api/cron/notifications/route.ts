import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailEnv, serverEnv } from "@/lib/env.server";
import { platformUrl, studioUrl } from "@/lib/urls";
import {
  classReminderEmail,
  eventTicketsEmail,
  packExpiringEmail,
  packGrantedEmail,
  sessionCancelledEmail,
  waitlistSpotEmail,
  staffInviteEmail,
  giftCardEmail,
  formationEmail,
  auditionEmail,
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
    case "audition_submitted":
    case "audition_reminder":
    case "audition_result": {
      const { data: ap } = await admin
        .from("audition_applications")
        .select("id, status, slot_id, auditions(title)")
        .eq("id", str("application_id") ?? "")
        .maybeSingle();
      if (!ap?.auditions) return null;
      const { data: slot } = ap.slot_id
        ? await admin.from("audition_slots").select("starts_at").eq("id", ap.slot_id).maybeSingle()
        : { data: null };
      const kind =
        n.template === "audition_submitted" ? "submitted" : n.template === "audition_reminder" ? "reminder" : ap.status === "waitlisted" ? "waitlisted" : ap.status === "rejected" ? "rejected" : null;
      if (!kind) return null;
      if (kind === "reminder" && ap.status !== "submitted") return null;
      return auditionEmail(studio, n.student_name, {
        kind,
        title: ap.auditions.title,
        slotAt: slot?.starts_at ?? null,
        url: studio.url(`/app/audiciones/${ap.id}`),
      });
    }
    case "formation_approved":
    case "formation_rejected":
    case "formation_enrolled": {
      const enrollmentId = str("enrollment_id");
      const { data: e } = await admin
        .from("formation_enrollments")
        .select("id, formations(title)")
        .eq("id", enrollmentId ?? "")
        .maybeSingle();
      if (!e?.formations) return null;
      const url = studio.url(`/app/formaciones/${e.id}`);
      if (n.template === "formation_approved") {
        const { data: fee } = await admin
          .from("formation_charges")
          .select("amount_cents")
          .eq("enrollment_id", e.id)
          .eq("kind", "enrollment")
          .maybeSingle();
        return formationEmail(studio, n.student_name, { kind: "approved", title: e.formations.title, feeCents: fee?.amount_cents ?? null, url });
      }
      return formationEmail(studio, n.student_name, {
        kind: n.template === "formation_rejected" ? "rejected" : "enrolled",
        title: e.formations.title,
        url,
      });
    }
    case "formation_due":
    case "formation_overdue": {
      const { data: c } = await admin.from("formation_charges").select("enrollment_id, status").eq("id", str("charge_id") ?? "").maybeSingle();
      if (!c || c.status !== "pending") return null; // ya la pagó
      return formationEmail(studio, n.student_name, {
        kind: n.template === "formation_due" ? "due" : "overdue",
        title: str("title") ?? "tu formación",
        number: num("number") ?? 1,
        amountCents: num("amount_cents") ?? 0,
        dueOn: str("due_on") ?? "",
        url: studio.url(`/app/formaciones/${c.enrollment_id}`),
      });
    }
    case "gift_card": {
      const { data: g } = await admin
        .from("gift_cards")
        .select("buyer_name, recipient_name, pack_name, code, access_token, status")
        .eq("id", str("gift_card_id") ?? "")
        .maybeSingle();
      if (!g || g.status !== "active") return null;
      return giftCardEmail(studio, {
        buyerName: g.buyer_name,
        recipientName: g.recipient_name,
        packName: g.pack_name,
        code: g.code,
        cardUrl: studio.url(`/regalo/${g.access_token}`),
      });
    }
    case "staff_invite": {
      const token = str("token");
      if (!token) return null;
      return staffInviteEmail(studio, { name: str("name"), role: str("role") ?? "teacher", acceptUrl: platformUrl(`/invitacion/${token}`) });
    }
    case "waitlist_spot": {
      const startsAt = str("starts_at");
      if (!startsAt || new Date(startsAt).getTime() < Date.now()) return null;
      return waitlistSpotEmail(studio, n.student_name, { title: str("title") ?? "tu clase", startsAt });
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
