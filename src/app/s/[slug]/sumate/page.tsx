import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserOnStudio } from "@/lib/auth";
import { getMyStudent, getStudioBySlug } from "@/lib/studio.server";
import { studioOffersFeature } from "@/lib/packs.server";
import { StudioHeader } from "@/components/studio/studio-header";
import { joinStudio } from "./actions";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Sumate" };

export default async function JoinPage({ params }: PageProps<"/s/[slug]/sumate">) {
  const { slug } = await params;
  const studio = await getStudioBySlug(slug);
  if (!studio) notFound();

  const user = await requireUserOnStudio("/sumate");
  if (await getMyStudent(studio.id, user.id)) redirect("/app");

  return (
    <div className="flex flex-1 flex-col">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 space-y-8 px-5 py-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Sumate a {studio.name}</h1>
          <p className="text-muted">Un último paso y ya podés comprar tu pack y reservar.</p>
        </div>
        <JoinForm
          action={joinStudio.bind(null, slug)}
          askRole={await studioOffersFeature(studio.id, "role_balance")}
          email={user.email}
        />
      </main>
    </div>
  );
}
