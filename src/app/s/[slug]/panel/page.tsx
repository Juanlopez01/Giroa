import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyStaffRole, getStudioBySlug } from "@/lib/studio.server";
import { logoUrl } from "@/lib/studio";
import { platformUrl, studioUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Panel" };

// Provisorio: el panel real (clases, packs, alumnos, pagos) llega en el paso 2.
export default async function PanelPage({ params }: PageProps<"/s/[slug]/panel">) {
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
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 bg-brand px-5 py-4 text-brand-foreground">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-1" />
        ) : null}
        <span className="font-semibold">{studio.name}</span>
      </header>
      <main className="mx-auto w-full max-w-md space-y-4 px-5 pt-10">
        <h1 className="text-2xl font-semibold">¡Tu estudio está listo!</h1>
        <p className="text-muted">
          Tus alumnos van a entrar por <span className="font-medium text-foreground">{studioUrl(slug).replace(/^https?:\/\//, "")}</span>.
          El próximo paso es cargar tus clases y packs.
        </p>
      </main>
    </div>
  );
}
