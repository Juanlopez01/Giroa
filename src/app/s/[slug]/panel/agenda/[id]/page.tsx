import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { notFound } from "next/navigation";
import { z } from "zod";
import { QrCode } from "lucide-react";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";
import { can } from "@/lib/gating";
import { checkInStudent, recordClassPayment, scanStudentQr, sellClassAtDesk } from "./actions";
import { MarkPresentButton, WalkInPicker } from "./attendance";
import { ActionButtons } from "../../formaciones/[id]/inscriptos/enrollment-controls";
import { formatArs } from "@/lib/money";
import { QrScanner } from "@/components/panel/qr-scanner";
import { LiveRefresh } from "@/components/ui/live-refresh";

export const metadata: Metadata = { title: "Asistencia" };

// La clase en vivo: los alumnos se dan el presente con el cartel QR y la lista
// se actualiza sola. El profe puede marcar a mano o sumar a quien llegó sin reserva.
export default async function SessionPage({ params }: PageProps<"/s/[slug]/panel/agenda/[id]">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio, canTakePayments } = await requireStaff(slug, `/panel/agenda/${id}`);
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: occ }, { data: bookings }, { data: students }, { data: waitlist }] = await Promise.all([
    supabase.from("session_occupancy").select("*").eq("session_id", id).eq("studio_id", studio.id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, status, dance_role, checked_in_at, is_trial, students!bookings_studio_id_student_id_fkey(id, full_name)")
      .eq("studio_id", studio.id)
      .eq("session_id", id)
      .in("status", ["booked", "attended", "no_show"])
      .order("created_at"),
    supabase.from("students").select("id, full_name").eq("studio_id", studio.id).eq("is_active", true).order("full_name").limit(2000),
    supabase
      .from("session_waitlist")
      .select("id, dance_role, notified_at, students!session_waitlist_studio_id_student_id_fkey(full_name, phone)")
      .eq("studio_id", studio.id)
      .eq("session_id", id)
      .eq("status", "waiting")
      .order("created_at"),
  ]);
  if (!occ?.session_id || !occ.starts_at || !occ.ends_at) notFound();

  const [{ data: offering }, { data: purchases }] = await Promise.all([
    supabase.from("offerings").select("title, kind, price_cents").eq("id", occ.offering_id ?? "").maybeSingle(),
    supabase.from("class_purchases").select("id, booking_id, status, amount_cents, method").eq("session_id", id).in("status", ["pending", "paid"]),
  ]);
  // Reservas pagas aparte (clase suelta o workshop): por reserva, su compra.
  const purchaseBy = new Map((purchases ?? []).flatMap((p) => (p.booking_id ? [[p.booking_id, p] as const] : [])));
  const sellsAtDesk = canTakePayments && Boolean(offering?.price_cents);

  const now = nowMs();
  const startsMs = new Date(occ.starts_at).getTime();
  const endsMs = new Date(occ.ends_at).getTime();
  // Mismo margen que check_in: desde 2 h antes.
  const canCheckIn = occ.status === "scheduled" && now >= startsMs - 2 * 3_600_000;
  // En vivo: desde 30 min antes hasta 30 min después (la lista se actualiza sola).
  const live = occ.status === "scheduled" && now >= startsMs - 30 * 60_000 && now <= endsMs + 30 * 60_000;
  const qrAllowed = await can(studio.id, "qr_checkin");
  const list = bookings ?? [];
  const arrived = list
    .filter((b) => b.status === "attended")
    .sort((a, b) => (b.checked_in_at ?? "").localeCompare(a.checked_in_at ?? ""));
  const pending = list.filter((b) => b.status === "booked");
  const noShow = list.filter((b) => b.status === "no_show");
  const bookedIds = new Set(list.map((b) => b.students?.id));
  const total = Math.max(occ.booked_count ?? 0, 1);
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {live ? <LiveRefresh everyMs={8000} /> : null}

      <div className="space-y-3">
        <Link href="/panel/agenda" className="text-sm text-muted hover:text-foreground">
          ← Agenda
        </Link>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            {live ? (
              <p className="flex items-center gap-1.5 text-xs font-medium tracking-widest text-success uppercase">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" aria-hidden /> En vivo
              </p>
            ) : null}
            <h1 className="font-serif text-3xl font-semibold">{offering?.title ?? "Clase"}</h1>
            <p className="text-muted">
              {formatDayLabel(toYmd(new Date(occ.starts_at), tz))} · {formatTime(occ.starts_at, tz)} a {formatTime(occ.ends_at, tz)}
            </p>
            <p className="text-sm text-muted">
              {occ.booked_count}/{occ.capacity} anotados
              {(occ.leader_count ?? 0) + (occ.follower_count ?? 0) > 0
                ? ` · ${occ.leader_count} ${occ.leader_count === 1 ? "líder" : "líderes"} · ${occ.follower_count} ${occ.follower_count === 1 ? "seguidor/a" : "seguidores/as"}`
                : ""}
            </p>
          </div>
          <div className="relative h-20 w-20 shrink-0" aria-label={`${arrived.length} presentes de ${occ.booked_count}`}>
            <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90" aria-hidden>
              <circle cx="32" cy="32" r={r} fill="none" className="stroke-border" strokeWidth="6" />
              {arrived.length ? (
                <circle
                  cx="32"
                  cy="32"
                  r={r}
                  fill="none"
                  className="stroke-success"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(1, arrived.length / total) * c} ${c}`}
                />
              ) : null}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="font-serif text-xl font-semibold tabular-nums">
                {arrived.length}
                <span className="text-sm text-muted">/{occ.booked_count}</span>
              </span>
              <span className="mt-1 text-[10px] tracking-wide text-muted uppercase">presentes</span>
            </div>
          </div>
        </div>
      </div>

      {occ.status === "cancelled" ? (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">Esta clase está cancelada.</p>
      ) : canCheckIn ? (
        <section className="space-y-3">
          {qrAllowed ? (
            <Link href="/panel/ajustes/qr" className="flex items-center gap-3 rounded-2xl bg-brand/10 p-4 text-sm">
              <QrCode className="h-5 w-5 shrink-0 text-brand" aria-hidden />
              <span>
                Los alumnos se dan el presente solos con el <span className="font-medium">cartel QR</span> del estudio. Esta lista se
                actualiza sola.
              </span>
            </Link>
          ) : null}
          {offering?.kind !== "special" ? (
            <WalkInPicker
              students={(students ?? []).filter((s) => !bookedIds.has(s.id)).map((s) => ({ id: s.id, name: s.full_name }))}
              mark={checkInStudent.bind(null, slug, id)}
            />
          ) : null}
        </section>
      ) : (
        <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">La asistencia se toma desde 2 horas antes de la clase.</p>
      )}

      {sellsAtDesk && occ.status === "scheduled" && now < endsMs ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Vender en el mostrador</h2>
          <WalkInPicker
            students={(students ?? []).filter((s) => !bookedIds.has(s.id)).map((s) => ({ id: s.id, name: s.full_name }))}
            mark={sellClassAtDesk.bind(null, slug, id)}
            placeholder={`Cobrar ${formatArs(offering!.price_cents!)} en efectivo: buscá por nombre`}
            doneLabel="anotado/a y pago"
          />
        </section>
      ) : null}

      {list.length === 0 ? (
        <p className="text-muted">Todavía no hay nadie anotado.</p>
      ) : (
        <>
          {pending.length ? (
            <section className="space-y-2">
              <h2 className="text-xs font-medium tracking-widest text-muted uppercase">
                {canCheckIn ? "Faltan llegar" : "Anotados"} · {pending.length}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {pending.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={b.students?.full_name ?? "Alumno"} size="sm" tone="muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.students?.full_name ?? "Alumno"}</p>
                      <p className="text-sm text-muted">
                        {b.dance_role ? ROLE_LABELS[b.dance_role] : "Sin rol"}
                        {b.is_trial ? (
                          <span className="ml-2 rounded-full bg-[var(--gold,#c8a46b)]/20 px-2 py-0.5 text-xs font-medium text-foreground">
                            Prueba
                          </span>
                        ) : null}
                        {purchaseBy.get(b.id)?.status === "paid" ? (
                          <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Pagó</span>
                        ) : purchaseBy.get(b.id)?.status === "pending" ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Falta pagar {formatArs(purchaseBy.get(b.id)!.amount_cents)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {purchaseBy.get(b.id)?.status === "pending" && canTakePayments ? (
                      <ActionButtons
                        buttons={[
                          { label: "Efectivo", run: recordClassPayment.bind(null, slug, id, purchaseBy.get(b.id)!.id, "cash") },
                          { label: "Transferencia", run: recordClassPayment.bind(null, slug, id, purchaseBy.get(b.id)!.id, "transfer") },
                        ]}
                      />
                    ) : canCheckIn && b.students ? (
                      <MarkPresentButton mark={checkInStudent.bind(null, slug, id, b.students.id)} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {arrived.length ? (
            <section className="space-y-2">
              <h2 className="text-xs font-medium tracking-widest text-success uppercase">Llegaron · {arrived.length}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {arrived.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={b.students?.full_name ?? "Alumno"} size="sm" tone="success" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.students?.full_name ?? "Alumno"}</p>
                      <p className="text-sm text-muted">{b.dance_role ? ROLE_LABELS[b.dance_role] : "Sin rol"}</p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-success">
                      ✓ {b.checked_in_at ? formatTime(b.checked_in_at, tz) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {noShow.length ? (
            <p className="text-sm text-muted">
              No vinieron: {noShow.map((b) => b.students?.full_name ?? "Alumno").join(", ")}.
            </p>
          ) : null}
        </>
      )}

      {canCheckIn && qrAllowed ? (
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">Escanear el QR de un alumno</summary>
          <div className="pt-3">
            <QrScanner scan={scanStudentQr.bind(null, slug, id)} hint="Apuntá al QR del alumno (en su app, Perfil → Mi QR)." />
          </div>
        </details>
      ) : null}

      {waitlist?.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Lista de espera · {waitlist.length}</h2>
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {waitlist.map((w, i) => (
              <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {i + 1}. {w.students?.full_name ?? "Alumno"}
                  </p>
                  <p className="text-sm text-muted">
                    {w.dance_role ? ROLE_LABELS[w.dance_role] : "Sin rol"}
                    {w.notified_at ? " · ya le avisamos que se liberó un lugar" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">Cuando alguien cancela, les avisamos por mail y el primero que reserva se queda el lugar.</p>
        </section>
      ) : null}
    </div>
  );
}
