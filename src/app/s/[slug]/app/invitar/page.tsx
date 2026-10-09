import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { studioUrl } from "@/lib/urls";
import { referralMessage } from "@/lib/referrals";
import { ShareInvite } from "@/components/student/share-invite";

export const metadata: Metadata = { title: "Invitá amigos" };

export default async function InvitePage({ params }: PageProps<"/s/[slug]/app/invitar">) {
  const { slug } = await params;
  const { studio, student } = await requireStudent(slug, "/app/invitar");
  if (!(await can(studio.id, "referrals"))) notFound();

  const supabase = await createClient();
  const [{ data: rewards }, { data: invited }] = await Promise.all([
    supabase.from("studios").select("referral_credits").eq("id", studio.id).single(),
    // RLS: solo los que invitó este alumno.
    supabase.from("referrals").select("status, credits").eq("referrer_student_id", student.id),
  ]);
  const credits = rewards?.referral_credits ?? 0;
  const link = studioUrl(slug, `/sumate?ref=${student.referral_code}`);
  const joined = invited?.length ?? 0;
  const rewarded = (invited ?? []).filter((r) => r.status === "rewarded");
  const earned = rewarded.reduce((sum, r) => sum + (r.credits ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link href="/app/perfil" className="inline-flex items-center gap-1 text-sm text-muted">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Perfil
      </Link>

      <section className="relative overflow-hidden rounded-3xl bg-brand p-6 text-brand-foreground">
        <svg viewBox="0 0 140 140" aria-hidden className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 opacity-25">
          <circle cx="70" cy="70" r="34" fill="none" stroke="currentColor" strokeWidth="10" />
          <path d="M14 76 A56 56 0 0 1 96 20" fill="none" stroke="var(--gold, #c8a46b)" strokeWidth="8" strokeLinecap="round" />
        </svg>
        <p className="relative text-xs font-medium tracking-widest uppercase opacity-80">Invitá amigos</p>
        <h1 className="relative mt-1 font-serif text-3xl font-semibold">
          {credits ? (credits === 1 ? "Una clase gratis para los dos" : `${credits} clases gratis para los dos`) : "Traé a tus amigos"}
        </h1>
        <p className="relative mt-2 text-sm opacity-90">
          {credits
            ? `Mandale tu link a quien quieras. Cuando se sume a ${studio.name} y compre su primer pack, a vos y a tu amigo/a les regalamos ${credits === 1 ? "una clase" : `${credits} clases`}.`
            : `Mandale tu link a quien quieras para que se sume a ${studio.name}.`}
        </p>
      </section>

      <ShareInvite link={link} message={referralMessage(studio.name, link, credits)} />

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Se sumaron</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{joined}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Clases ganadas</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{earned}</p>
        </div>
      </section>
      {joined > rewarded.length ? (
        <p className="text-sm text-muted">
          {joined - rewarded.length === 1 ? "1 amigo/a se sumó" : `${joined - rewarded.length} amigos se sumaron`} y todavía no
          compró su primer pack. Apenas lo haga, te llega tu regalo.
        </p>
      ) : null}
    </div>
  );
}
