import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMyMembership, getStudioBySlug, type PublicStudio } from "@/lib/studio.server";
import { logoUrl } from "@/lib/studio";
import { platformUrl, studioUrl } from "@/lib/urls";
import { ROLE_INFO } from "@/lib/team";
import { PanelSidebar, PanelTabBar } from "./panel-nav";
import { AccessGate } from "./access-gate";
import { daysUntil, getStudioAccess } from "@/lib/subscription.server";
import { nowMs } from "@/lib/datetime";
import { InstallPrompt } from "@/components/studio/install-prompt";

// El panel se instala como su propia app ("Panel · Estudio"), separada de la del alumno.
export async function generateMetadata({ params }: LayoutProps<"/s/[slug]/panel">): Promise<Metadata> {
  const studio = await getStudioBySlug((await params).slug);
  if (!studio) return {};
  return {
    manifest: "/api/pwa/manifest?app=panel",
    icons: {
      icon: [{ url: "/api/pwa/icon?size=192&app=panel", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/api/pwa/icon?size=180&app=panel", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: `Panel ${studio.name}`, statusBarStyle: "default" },
  };
}

function StudioMark({ studio, size = "h-8 w-8" }: { studio: PublicStudio; size?: string }) {
  const logo = logoUrl(studio.logo_path);
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className={`${size} shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border`} />
  ) : (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground`}>
      {studio.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// Panel del estudio: en la compu, barra lateral; en el celu, encabezado chico y
// barra flotante con el ＋ de acciones rápidas (la misma línea que la app del alumno).
export default async function PanelLayout({ children, params }: LayoutProps<"/s/[slug]/panel">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  const user = await requireUser(studioUrl(slug, "/panel"));
  const member = await getMyMembership(studio.id, user.id);
  const role = member?.role;

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

  const isAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const access = { isAdmin, isOwner, canTakePayments: isAdmin || Boolean(member.can_take_payments) };
  const studioAccess = await getStudioAccess(studio.id);
  const days = daysUntil(studioAccess.until, nowMs());
  const notice =
    studioAccess.state === "trial" && days !== null
      ? `Prueba gratis: te ${days === 1 ? "queda 1 día" : `quedan ${days} días`}.`
      : studioAccess.state === "grace"
        ? `${studioAccess.status === "past_due" ? "No pudimos cobrar tu suscripción" : "Terminó tu prueba"}: te ${days === 1 ? "queda 1 día" : `quedan ${days} días`} para suscribirte.`
        : null;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* Compu: barra lateral. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-5 md:flex print:hidden">
        <div className="flex items-center gap-2.5 px-2">
          <StudioMark studio={studio} size="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{studio.name}</p>
            <p className="text-xs text-muted">{ROLE_INFO[role].label}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PanelSidebar {...access} />
        </div>
        <a href={platformUrl("/estudios")} className="flex items-center gap-2 px-3 text-sm text-muted hover:text-foreground">
          <ArrowLeftRight className="h-4 w-4" aria-hidden /> Cambiar de estudio
        </a>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {/* Celu: encabezado chico, pegado arriba. */}
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md md:hidden print:hidden">
          <div className="flex h-14 items-center gap-2.5 px-5">
            <StudioMark studio={studio} />
            <span className="min-w-0 truncate text-sm font-semibold">{studio.name}</span>
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              {ROLE_INFO[role].label}
            </span>
          </div>
        </header>

        {notice && isOwner ? (
          <div className={`px-5 py-2 text-center text-sm print:hidden ${studioAccess.state === "grace" ? "bg-danger/10 text-danger" : "bg-brand/10"}`}>
            {notice}{" "}
            <a href="/panel/plan" className="font-medium underline">
              Elegí tu plan
            </a>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
          <div className="mb-4 empty:hidden print:hidden">
            <InstallPrompt studioName={studio.name} app="panel" />
          </div>
          <AccessGate blocked={studioAccess.state === "blocked"} isAdmin={isOwner}>
            {children}
          </AccessGate>
        </main>
      </div>

      {/* Celu: barra flotante. */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden print:hidden">
        <div className="mx-auto max-w-md">
          <PanelTabBar {...access} />
        </div>
      </div>
    </div>
  );
}
