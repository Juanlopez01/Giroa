import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { formatDayLabel, formatTime, nowMs, todayYmd, toYmd } from "@/lib/datetime";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { SmallAction } from "../equipo/team-controls";
import { deleteAnnouncement, publishAnnouncement } from "./actions";
import { AnnouncementForm } from "./announcement-form";

export const metadata: Metadata = { title: "Anuncios" };

export default async function AnnouncementsPage({ params }: PageProps<"/s/[slug]/panel/anuncios">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/anuncios");
  const tz = studio.timezone;
  if (!(await can(studio.id, "announcements"))) return <UpgradeNotice feature="announcements" what="Los anuncios" />;

  const supabase = await createClient();
  const [{ data: list }, { data: offerings }, { data: formations }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, audience, visible_until, emailed_count, send_email, created_at, offerings(title), formations(title)")
      .eq("studio_id", studio.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("offerings").select("id, title").eq("studio_id", studio.id).eq("is_active", true).order("title"),
    supabase.from("formations").select("id, title").eq("studio_id", studio.id).neq("status", "archived").order("starts_on", { ascending: false }),
  ]);
  const now = nowMs();
  const day = (iso: string) => `${formatDayLabel(toYmd(new Date(iso), tz))} ${formatTime(iso, tz)}`;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Anuncios</h1>
        <p className="text-muted">
          Un aviso para tus alumnos: les aparece arriba en el Inicio de la app y, si querés, les llega por mail.
        </p>
      </div>

      <AnnouncementForm
        action={publishAnnouncement.bind(null, slug)}
        offerings={(offerings ?? []).map((o) => ({ id: o.id, label: o.title }))}
        formations={(formations ?? []).map((f) => ({ id: f.id, label: f.title }))}
        minDate={todayYmd(tz)}
      />

      <section className="space-y-3">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Publicados</h2>
        {!list?.length ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-muted">Todavía no publicaste anuncios.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((a) => {
              const expired = a.visible_until !== null && new Date(a.visible_until).getTime() <= now;
              const to =
                a.audience === "offering"
                  ? `A los de ${a.offerings?.title ?? "una clase"}`
                  : a.audience === "formation"
                    ? `A los de ${a.formations?.title ?? "una formación"}`
                    : "A todos";
              return (
                <li key={a.id} className={`space-y-2 rounded-2xl border border-border bg-surface p-4 ${expired ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Megaphone className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.title}</p>
                      <p className="text-sm whitespace-pre-line text-muted">{a.body}</p>
                    </div>
                    <SmallAction
                      run={deleteAnnouncement.bind(null, slug, a.id)}
                      label="Borrar"
                      confirmText="¿Borrar el anuncio? Deja de verse en la app."
                      danger
                    />
                  </div>
                  <p className="text-xs text-muted">
                    {to} · {day(a.created_at)}
                    {a.send_email ? ` · por mail a ${a.emailed_count}` : " · sin mail"}
                    {a.visible_until ? (expired ? " · ya no se ve" : ` · se ve hasta el ${formatDayLabel(toYmd(new Date(new Date(a.visible_until).getTime() - 1), tz)).toLowerCase()}`) : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
