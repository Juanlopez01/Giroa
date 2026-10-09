import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { formatDayLabel, toYmd } from "@/lib/datetime";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { FormMessage } from "@/components/ui/field";
import { setReferralCredits } from "./actions";

export const metadata: Metadata = { title: "Referidos" };

export default async function ReferralsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/referidos">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/referidos");
  if (!(await can(studio.id, "referrals"))) return <UpgradeNotice feature="referrals" what="Los referidos" />;
  const saved = (await searchParams).ok === "1";

  const supabase = await createClient();
  const [{ data: settings }, { data: list }] = await Promise.all([
    supabase.from("studios").select("referral_credits").eq("id", studio.id).single(),
    supabase
      .from("referrals")
      .select(
        "id, status, credits, created_at, rewarded_at, referrer:students!referrals_studio_id_referrer_student_id_fkey(id, full_name), referred:students!referrals_studio_id_referred_student_id_fkey(id, full_name)",
      )
      .eq("studio_id", studio.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const credits = settings?.referral_credits ?? 0;
  const rewarded = (list ?? []).filter((r) => r.status === "rewarded");
  const gifted = rewarded.reduce((sum, r) => sum + (r.credits ?? 0) * 2, 0);
  const day = (iso: string) => formatDayLabel(toYmd(new Date(iso), studio.timezone));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold">Referidos</h1>
        <p className="text-muted">
          Cada alumno tiene su link para invitar amigos (en su app: Perfil → Invitá amigos). Cuando el amigo se suma y
          compra su primer pack, los dos reciben clases de regalo, válidas por 60 días.
        </p>
      </div>

      {saved ? <FormMessage ok message="Guardamos los cambios." /> : null}

      <form action={setReferralCredits.bind(null, slug)} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <label className="block space-y-1.5">
          <span className="font-medium">Clases de regalo para cada uno</span>
          <select
            name="credits"
            defaultValue={credits}
            className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-base"
          >
            <option value={0}>Apagado (no se regala nada)</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 clase" : `${n} clases`} para cada uno
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-11 rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground">
          Guardar
        </button>
      </form>

      <section className="grid grid-cols-3 gap-3">
        {[
          ["Invitados", list?.length ?? 0],
          ["Compraron", rewarded.length],
          ["Regaladas", gifted],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
            <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {!list?.length ? (
        <p className="text-muted">Todavía nadie se sumó con un link de invitación.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate">
                  <Link href={`/panel/alumnos/${r.referrer?.id}`} className="font-medium hover:underline">
                    {r.referrer?.full_name}
                  </Link>{" "}
                  <span className="text-muted">invitó a</span>{" "}
                  <Link href={`/panel/alumnos/${r.referred?.id}`} className="font-medium hover:underline">
                    {r.referred?.full_name}
                  </Link>
                </p>
                <p className="text-sm text-muted">Se sumó el {day(r.created_at).toLowerCase()}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${r.status === "rewarded" ? "bg-success/15 text-success" : "bg-border/60 text-muted"}`}
              >
                {r.status === "rewarded" ? `+${r.credits} c/u` : "Sin comprar"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
