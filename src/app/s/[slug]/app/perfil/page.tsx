import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { studioOffersFeature } from "@/lib/packs.server";
import { signOutFromStudio } from "./actions";
import { updateProfile } from "../actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Perfil" };

export default async function StudentProfilePage({ params }: PageProps<"/s/[slug]/app/perfil">) {
  const { slug } = await params;
  const { studio, student, user } = await requireStudent(slug, "/app/perfil");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tu perfil</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </div>
      <ProfileForm
        action={updateProfile.bind(null, slug)}
        askRole={await studioOffersFeature(studio.id, "role_balance")}
        initial={{ fullName: student.full_name, phone: student.phone ?? "", role: student.default_role ?? "" }}
      />
      <Link href="/app/qr" className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
        <span>
          <span className="block font-medium">Mi QR</span>
          <span className="block text-sm text-muted">Por si el profe te toma el presente con su celu.</span>
        </span>
        <span aria-hidden className="text-brand">
          →
        </span>
      </Link>
      <form action={signOutFromStudio} className="border-t border-border pt-6">
        <button type="submit" className="text-sm text-muted hover:text-foreground">
          Salir
        </button>
      </form>
    </div>
  );
}
