import type { Metadata } from "next";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { nowMs } from "@/lib/datetime";
import { cancelInvite, inviteMember, removeMember, resendInvite, updateMember } from "./actions";
import { InviteForm, MemberEditor, SmallAction } from "./team-controls";
import { ROLE_INFO } from "@/lib/team";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage({ params }: PageProps<"/s/[slug]/panel/equipo">) {
  const { slug } = await params;
  const { studio, user } = await requireAdmin(slug, "/panel/equipo");
  const supabase = await createClient();

  const [allowed, { data: members }, { data: invites }] = await Promise.all([
    can(studio.id, "teacher_permissions"),
    supabase.from("studio_members").select("id, user_id, role, display_name, can_take_payments, created_at").eq("studio_id", studio.id).order("created_at"),
    supabase
      .from("studio_invites")
      .select("id, email, display_name, role, can_take_payments, expires_at")
      .eq("studio_id", studio.id)
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // Emails del equipo (auth.users no se expone por la API: se leen en el servidor).
  const admin = createAdminClient();
  const emails = new Map(
    await Promise.all(
      (members ?? []).map(async (m) => [m.user_id, (await admin.auth.admin.getUserById(m.user_id)).data.user?.email ?? ""] as const),
    ),
  );
  const now = nowMs();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Equipo</h1>
        <p className="text-muted">Sumá a tus profes y encargados. Cada uno entra con su email y ve solo lo que le corresponde.</p>
      </div>

      <section className="space-y-3">
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {(members ?? []).map((m) => {
            const isMe = m.user_id === user.id;
            return (
              <li key={m.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {m.display_name || emails.get(m.user_id) || "Sin nombre"}
                      {isMe ? <span className="ml-2 text-xs font-normal text-muted">vos</span> : null}
                    </p>
                    <p className="truncate text-sm text-muted">{emails.get(m.user_id)}</p>
                    <p className="text-sm">
                      {ROLE_INFO[m.role].label}
                      {m.role === "teacher" && m.can_take_payments ? " · puede cobrar" : ""}
                    </p>
                  </div>
                  {m.role !== "owner" && !isMe ? (
                    <SmallAction
                      run={removeMember.bind(null, slug, m.id)}
                      label="Sacar"
                      danger
                      confirmText={`¿Sacar a ${m.display_name || emails.get(m.user_id)} del equipo? Deja de tener acceso al panel.`}
                    />
                  ) : null}
                </div>
                {m.role !== "owner" && !isMe ? (
                  <MemberEditor
                    role={m.role}
                    canTakePayments={m.can_take_payments}
                    save={updateMember.bind(null, slug, m.id)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {invites?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {invites.map((i) => {
              const expired = new Date(i.expires_at).getTime() <= now;
              const role = i.role === "admin" ? "admin" : "teacher";
              return (
                <li key={i.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.display_name || i.email}</p>
                    <p className="truncate text-sm text-muted">
                      {i.email} · {ROLE_INFO[role].label}
                      {expired ? " · venció" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SmallAction run={resendInvite.bind(null, slug, i.email, role, i.can_take_payments)} label="Reenviar" />
                    <SmallAction run={cancelInvite.bind(null, slug, i.id)} label="Cancelar" danger />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Invitar a alguien</h2>
        {allowed ? (
          <InviteForm action={inviteMember.bind(null, slug)} />
        ) : (
          <UpgradeNotice feature="teacher_permissions" what="Sumar profes y encargados" />
        )}
      </section>
    </div>
  );
}
