import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { platformUrl } from "@/lib/urls";
import { signOut } from "../../login/actions";
import { acceptInvite } from "./actions";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = { title: "Invitación", robots: { index: false } };

type Invite = {
  email: string;
  role: "admin" | "teacher";
  display_name: string | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
  studio: { name: string; slug: string };
};

// app.giroa.com.ar/invitacion/{token}: aceptar sumarse al equipo de un estudio.
export default async function InvitePage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();

  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([supabase.rpc("get_invite", { p_token: token }), getCurrentUser()]);
  const invite = data as Invite | null;
  if (!invite) notFound();

  const role = invite.role === "admin" ? "encargado/a" : "profe";
  const loginUrl = platformUrl(`/login?next=${encodeURIComponent(`/invitacion/${token}`)}`);

  return (
    <div className="mx-auto max-w-md space-y-6 pt-10">
      <div className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-brand uppercase">Invitación</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Sumate al equipo de {invite.studio.name}</h1>
        <p className="text-muted">
          Te invitaron como <span className="font-medium text-foreground">{role}</span>.
        </p>
      </div>

      {invite.status === "accepted" ? (
        <p className="rounded-xl bg-border/50 px-4 py-3">Esta invitación ya se usó.</p>
      ) : invite.status === "cancelled" ? (
        <p className="rounded-xl bg-border/50 px-4 py-3">El estudio canceló esta invitación.</p>
      ) : invite.status === "expired" ? (
        <p className="rounded-xl bg-border/50 px-4 py-3">La invitación venció. Pedile al estudio que te la reenvíe.</p>
      ) : !user ? (
        <div className="space-y-3">
          <p>
            Entrá con <span className="font-medium">{invite.email}</span> para aceptarla. Te mandamos un link a ese mail, sin
            contraseña.
          </p>
          <Link href={loginUrl} className="inline-flex h-12 items-center rounded-xl bg-brand px-5 font-medium text-brand-foreground">
            Entrar con mi email
          </Link>
        </div>
      ) : user.email?.toLowerCase() !== invite.email ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-danger">
            Entraste como {user.email}, pero la invitación es para {invite.email}.
          </p>
          <form action={signOut}>
            <button type="submit" className="font-medium text-brand">
              Salir y entrar con {invite.email}
            </button>
          </form>
        </div>
      ) : (
        <AcceptButton accept={acceptInvite.bind(null, token)} />
      )}
    </div>
  );
}
