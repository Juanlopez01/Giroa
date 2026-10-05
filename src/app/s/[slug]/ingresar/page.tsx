import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStudioBySlug } from "@/lib/studio.server";
import { FormMessage } from "@/components/ui/field";
import { LoginForm } from "@/components/auth/login-form";
import { StudioHeader } from "@/components/studio/studio-header";

export const metadata: Metadata = { title: "Entrar" };

/** Solo rutas internas del estudio ("/app", "/sumate"...). */
function safeStudioPath(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/app";
}

// Login con la marca del estudio. El magic link vuelve a este mismo subdominio.
export default async function StudioLoginPage({ params, searchParams }: PageProps<"/s/[slug]/ingresar">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  const sp = await searchParams;
  const next = safeStudioPath(sp.next);
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 space-y-8 px-5 py-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Entrá a {studio.name}</h1>
          <p className="text-muted">Te mandamos un link a tu email para entrar. Sin contraseñas.</p>
        </div>
        {sp.error === "link" ? <FormMessage ok={false} message="El link venció o ya se usó. Pedí uno nuevo." /> : null}
        <LoginForm next={next} />
      </main>
    </div>
  );
}
