import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { listDisciplines } from "@/lib/disciplines.server";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, nowMs, todayYmd, toYmd } from "@/lib/datetime";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { createWorkshop } from "./actions";
import { WorkshopForm } from "./workshop-form";

export const metadata: Metadata = { title: "Workshops" };

export default async function WorkshopsPage({ params }: PageProps<"/s/[slug]/panel/workshops">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/workshops");
  const tz = studio.timezone;
  if (!(await can(studio.id, "specials"))) return <UpgradeNotice feature="specials" what="Los workshops" />;

  const supabase = await createClient();
  const now = new Date(nowMs());
  const [disciplines, { data: sessions }] = await Promise.all([
    listDisciplines(),
    supabase
      .from("session_occupancy")
      .select("session_id, offering_id, starts_at, ends_at, status, capacity, booked_count")
      .eq("studio_id", studio.id)
      .gte("ends_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
      .order("starts_at"),
  ]);
  const { data: specials } = await supabase
    .from("offerings")
    .select("id, title, price_cents, pack_allowed, teacher_name")
    .eq("studio_id", studio.id)
    .eq("kind", "special");
  const byId = new Map((specials ?? []).map((o) => [o.id, o]));
  const list = (sessions ?? []).filter((s) => s.offering_id && byId.has(s.offering_id));
  const upcoming = list.filter((s) => s.ends_at && new Date(s.ends_at) >= now);
  const past = list.filter((s) => s.ends_at && new Date(s.ends_at) < now).reverse();

  const row = (s: (typeof list)[number]) => {
    const o = byId.get(s.offering_id!)!;
    return (
      <li key={s.session_id}>
        <Link href={`/panel/agenda/${s.session_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{o.title}</span>
            <span className="block text-sm text-muted">
              {formatDayLabel(toYmd(new Date(s.starts_at!), tz))} · {formatTime(s.starts_at!, tz)} a {formatTime(s.ends_at!, tz)}
              {o.teacher_name ? ` · ${o.teacher_name}` : ""}
            </span>
          </span>
          <span className="shrink-0 text-right text-sm">
            <span className="block font-semibold tabular-nums">{o.price_cents ? formatArs(o.price_cents) : ""}</span>
            <span className="block text-muted">
              {s.status === "cancelled" ? "Cancelado" : `${s.booked_count ?? 0}/${s.capacity}`}
              {o.pack_allowed ? " · con pack" : ""}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Workshops y seminarios</h1>
        <p className="text-muted">
          Una clase especial con su precio. Tus alumnos la reservan y la pagan con Mercado Pago (o la cobrás en el estudio). Se
          ve en la app y en tu página, junto a las clases.
        </p>
      </div>

      {upcoming.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Próximos</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{upcoming.map(row)}</ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Nuevo workshop</h2>
        <WorkshopForm
          action={createWorkshop.bind(null, slug)}
          disciplines={disciplines.map((d) => ({ key: d.key, name: d.name }))}
          minDate={todayYmd(tz)}
        />
      </section>

      {past.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Últimos 30 días</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface opacity-80">{past.map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
