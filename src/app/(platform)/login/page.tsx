import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/urls";
import { FormMessage } from "@/components/ui/field";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null, "/estudios");

  if (await getCurrentUser()) redirect(next);

  return (
    <div className="space-y-8 pt-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Entrá a Giroa</h1>
        <p className="text-muted">Te mandamos un link a tu email. Sin contraseñas.</p>
      </div>
      {params.error === "link" ? (
        <FormMessage ok={false} message="El link venció o ya se usó. Pedí uno nuevo." />
      ) : null}
      <LoginForm next={next} />
    </div>
  );
}
