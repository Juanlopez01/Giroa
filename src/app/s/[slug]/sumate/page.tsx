import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserOnStudio } from "@/lib/auth";
import { getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { studioOffersFeature } from "@/lib/packs.server";
import { StudioHeader } from "@/components/studio/studio-header";
import { joinStudio } from "./actions";
import { JoinForm } from "./join-form";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { REF_CODE } from "@/lib/referrals";

export const metadata: Metadata = { title: "Sumate" };

export default async function JoinPage({ params, searchParams }: PageProps<"/s/[slug]/sumate">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  // Link de invitación de un alumno: "/sumate?ref=ABC234" (se conserva al pedir login).
  const rawRef = (await searchParams).ref;
  const ref = typeof rawRef === "string" && REF_CODE.test(rawRef) ? rawRef.toUpperCase() : null;
  const user = await requireUserOnStudio(ref ? `/sumate?ref=${ref}` : "/sumate");
  if (await getMyStudent(studio.id, user.id)) redirect("/app");

  const supabase = await createClient();
  const [referralsOn, { data: rewards }] = ref
    ? await Promise.all([can(studio.id, "referrals"), supabase.from("studios").select("referral_credits").eq("id", studio.id).single()])
    : [false, { data: null }];
  const giftCredits = referralsOn ? (rewards?.referral_credits ?? 0) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 space-y-8 px-5 py-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Sumate a {studio.name}</h1>
          <p className="text-muted">Un último paso y ya podés comprar tu pack y reservar.</p>
        </div>
        {giftCredits ? (
          <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
            Venís invitado/a 🎁 Cuando compres tu primer pack, te regalamos {giftCredits === 1 ? "1 clase" : `${giftCredits} clases`} (y
            a quien te invitó, también).
          </p>
        ) : null}
        <JoinForm
          action={joinStudio.bind(null, slug, referralsOn ? ref : null)}
          askRole={await studioOffersFeature(studio.id, "role_balance")}
          email={user.email}
        />
      </main>
    </div>
  );
}
