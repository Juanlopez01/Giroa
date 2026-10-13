import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { listTeamOptions } from "@/lib/studio.server";
import { centsToInput } from "@/lib/money";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { saveRules, type RuleInput } from "../actions";
import { RulesEditor } from "./rules-editor";

export const metadata: Metadata = { title: "Qué cobra cada profe" };

export default async function PayoutRulesPage({ params }: PageProps<"/s/[slug]/panel/liquidaciones/reglas">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/liquidaciones/reglas");
  if (!(await can(studio.id, "teacher_payouts"))) return <UpgradeNotice feature="teacher_payouts" what="La liquidación de profes" />;

  const supabase = await createClient();
  const [{ data: offerings }, { data: rules }, team] = await Promise.all([
    supabase
      .from("offerings")
      .select("id, title, kind, teacher_name, teacher_member_id, is_active")
      .eq("studio_id", studio.id)
      .in("kind", ["regular", "special"])
      .order("is_active", { ascending: false })
      .order("kind")
      .order("title"),
    supabase.from("payout_rules").select("offering_id, payee_name, member_id, kind, amount_cents, percent").eq("studio_id", studio.id).order("created_at"),
    listTeamOptions(studio.id),
  ]);

  const byOffering = new Map<string, RuleInput[]>();
  for (const r of rules ?? []) {
    byOffering.set(r.offering_id, [
      ...(byOffering.get(r.offering_id) ?? []),
      {
        payeeName: r.payee_name,
        memberId: r.member_id ?? "",
        kind: r.kind,
        value: r.kind === "percent" ? String(r.percent ?? "").replace(".", ",") : centsToInput(r.amount_cents ?? 0),
      },
    ]);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/panel/liquidaciones" className="text-sm text-muted hover:text-foreground">
          ← Liquidación de profes
        </Link>
        <h1 className="font-serif text-3xl font-semibold">Qué cobra cada profe</h1>
        <p className="text-muted">
          En cada clase, quién la da y cómo cobra: fijo por clase, por alumno presente o un % de lo que generó la clase (lo que
          pagaron los alumnos por ese lugar). Si la dan de a dos, agregá a los dos.
        </p>
      </div>

      {!offerings?.length ? (
        <p className="text-muted">Todavía no tenés clases. Creálas en Clases o Workshops.</p>
      ) : (
        <ul className="space-y-4">
          {offerings.map((o) => {
            const member = o.teacher_member_id ? team.find((t) => t.id === o.teacher_member_id) : undefined;
            const suggested: RuleInput | null = member
              ? { payeeName: member.name, memberId: member.id, kind: "per_class", value: "" }
              : o.teacher_name
                ? { payeeName: o.teacher_name, memberId: "", kind: "per_class", value: "" }
                : null;
            return (
              <li key={o.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                <div>
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-sm text-muted">
                    {o.kind === "special" ? "Workshop" : "Clase"}
                    {o.is_active ? "" : " · pausada"}
                  </p>
                </div>
                <RulesEditor initial={byOffering.get(o.id) ?? []} suggested={suggested} team={team} save={saveRules.bind(null, slug, o.id)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
