import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { studioOffersFeature } from "@/lib/packs.server";
import { updateProfile } from "../../actions";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Mis datos" };

export default async function MyDataPage({ params }: PageProps<"/s/[slug]/app/perfil/datos">) {
  const { slug } = await params;
  const { studio, student, user } = await requireStudent(slug, "/app/perfil/datos");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/app/perfil" className="text-sm text-muted">
          ← Perfil
        </Link>
        <h1 className="font-serif text-3xl font-semibold">Mis datos</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </div>
      <ProfileForm
        action={updateProfile.bind(null, slug)}
        askRole={await studioOffersFeature(studio.id, "role_balance")}
        initial={{ fullName: student.full_name, phone: student.phone ?? "", role: student.default_role ?? "" }}
      />
    </div>
  );
}
