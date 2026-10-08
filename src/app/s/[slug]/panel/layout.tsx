import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyStaffRole, getStudioBySlug } from "@/lib/studio.server";
import { logoUrl } from "@/lib/studio";
import { platformUrl, studioUrl } from "@/lib/urls";
import { PanelNav } from "./panel-nav";
import { AccessGate } from "./access-gate";
import { daysUntil, getStudioAccess } from "@/lib/subscription.server";
import { nowMs } from "@/lib/datetime";

export default async function PanelLayout({ children, params }: LayoutProps<"/s/[slug]/panel">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  const user = await requireUser(studioUrl(slug, "/panel"));
  const role = await getMyStaffRole(studio.id, user.id);

  if (!role) {
    return (
      <main className="mx-auto w-full max-w-md space-y-4 px-5 pt-16">
        <h1 className="text-2xl font-semibold">No tenés acceso a este panel</h1>
        <p className="text-muted">
          Entraste como {user.email}. Si sos parte del staff de {studio.name}, pedile al dueño que te sume.
        </p>
        <a href={platformUrl("/estudios")} className="font-medium text-brand">
          Ver tus estudios
        </a>
      </main>
    );
  }

  const logo = logoUrl(studio.logo_path);
  const isAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const access = await getStudioAccess(studio.id);
  const days = daysUntil(access.until, nowMs());
  const notice =
    access.state === "trial" && days !== null
      ? `Prueba gratis: te ${days === 1 ? "queda 1 día" : `quedan ${days} días`}.`
      : access.state === "grace"
        ? `${access.status === "past_due" ? "No pudimos cobrar tu suscripción" : "Terminó tu prueba"}: te ${days === 1 ? "queda 1 día" : `quedan ${days} días`} para suscribirte.`
        : null;

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-10 border-b print:hidden border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground">
              {studio.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="truncate font-semibold">{studio.name}</span>
          <a href={platformUrl("/estudios")} className="ml-auto shrink-0 text-sm text-muted hover:text-foreground">
            Cambiar
          </a>
        </div>
        <div className="mx-auto hidden max-w-5xl px-3 md:block">
          <PanelNav variant="top" isAdmin={isAdmin} isOwner={isOwner} />
        </div>
      </header>

      {notice && isOwner ? (
        <div className={`px-5 py-2 text-center text-sm print:hidden ${access.state === "grace" ? "bg-danger/10 text-danger" : "bg-brand/10"}`}>
          {notice}{" "}
          {isOwner ? (
            <a href="/panel/plan" className="font-medium underline">
              Elegí tu plan
            </a>
          ) : null}
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 print:max-w-none print:p-0">
        <AccessGate blocked={access.state === "blocked"} isAdmin={isOwner}>
          {children}
        </AccessGate>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface md:hidden print:hidden">
        <PanelNav variant="bottom" isAdmin={isAdmin} isOwner={isOwner} />
      </div>
    </div>
  );
}
