import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logoUrl } from "@/lib/studio";
import { studioUrl } from "@/lib/urls";
import { signOut } from "../login/actions";
import { readableOn } from "@/lib/color";

export const metadata: Metadata = { title: "Tus estudios" };

const roleLabels = { owner: "Dueño/a", admin: "Encargado/a", teacher: "Profe" } as const;

type StudioCard = { id: string; name: string; slug: string; brand_color: string; logo_path: string | null };

export default async function StudiosPage() {
  const user = await requireUser("/estudios");
  const supabase = await createClient();

  const [{ data: memberships }, { data: studentOf }] = await Promise.all([
    supabase
      .from("studio_members")
      .select("role, studios(id, name, slug, brand_color, logo_path)")
      .eq("user_id", user.id),
    supabase.from("students").select("studios(id, name, slug, brand_color, logo_path)").eq("user_id", user.id),
  ]);

  const staff = (memberships ?? []).filter((m) => m.studios);
  const asStudent = (studentOf ?? []).map((s) => s.studios).filter((s): s is StudioCard => Boolean(s));

  // Primer ingreso de un dueño: directo a crear su estudio.
  if (staff.length === 0 && asStudent.length === 0) redirect("/onboarding");
  // Un solo estudio y nada más: directo a su panel.
  if (staff.length === 1 && asStudent.length === 0 && staff[0]?.studios) {
    redirect(studioUrl(staff[0].studios.slug, "/panel"));
  }

  return (
    <div className="space-y-8 pt-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Tus estudios</h1>

      {staff.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Administrás</h2>
          {staff.map((m) =>
            m.studios ? (
              <StudioLink
                key={m.studios.id}
                studio={m.studios}
                href={studioUrl(m.studios.slug, "/panel")}
                caption={roleLabels[m.role]}
              />
            ) : null,
          )}
        </section>
      ) : null}

      {asStudent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Sos alumno/a</h2>
          {asStudent.map((s) => (
            <StudioLink key={s.id} studio={s} href={studioUrl(s.slug, "/app")} caption="Reservar clases" />
          ))}
        </section>
      ) : null}

      <div className="space-y-3 border-t border-border pt-6">
        <a href="/onboarding" className="block text-sm font-medium text-brand">
          + Crear otro estudio
        </a>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted hover:text-foreground">
            Salir ({user.email})
          </button>
        </form>
      </div>
    </div>
  );
}

function StudioLink({ studio, href, caption }: { studio: StudioCard; href: string; caption: string }) {
  const logo = logoUrl(studio.logo_path);
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-foreground"
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-11 w-11 rounded-lg object-contain" />
      ) : (
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-semibold"
          style={{ backgroundColor: studio.brand_color, color: readableOn(studio.brand_color) }}
        >
          {studio.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium">{studio.name}</p>
        <p className="text-sm text-muted">{caption}</p>
      </div>
    </a>
  );
}
