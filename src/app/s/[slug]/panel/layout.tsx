import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyStaffRole, getStudioBySlug } from "@/lib/studio.server";
import { logoUrl } from "@/lib/studio";
import { platformUrl, studioUrl } from "@/lib/urls";
import { PanelNav } from "./panel-nav";

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

  return (
    <div className="flex flex-1 flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
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
          <PanelNav variant="top" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">{children}</main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface md:hidden">
        <PanelNav variant="bottom" />
      </div>
    </div>
  );
}
