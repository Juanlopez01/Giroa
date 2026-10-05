import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { packSummary } from "@/lib/packs.server";
import { registerPayment } from "../actions";
import { PaymentForm } from "../payment-form";

export const metadata: Metadata = { title: "Registrar pago" };

export default async function NewPaymentPage({ params, searchParams }: PageProps<"/s/[slug]/panel/pagos/nuevo">) {
  const { slug } = await params;
  const alumno = z.uuid().safeParse((await searchParams).alumno);
  const { studio, isAdmin } = await requireStaff(slug, "/panel/pagos/nuevo");
  const supabase = await createClient();

  const [{ data: students }, { data: packs }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, email, phone")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .order("full_name")
      .limit(2000),
    supabase
      .from("pack_products")
      .select("id, name, credits, validity_days, price_cents, is_couple")
      .eq("studio_id", studio.id)
      .eq("is_active", true)
      .order("sort")
      .order("price_cents"),
  ]);

  const initialStudentId =
    alumno.success && students?.some((s) => s.id === alumno.data) ? alumno.data : null;
  const backHref = initialStudentId ? `/panel/alumnos/${initialStudentId}` : isAdmin ? "/panel/pagos" : "/panel/alumnos";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link href={backHref} className="text-sm text-muted hover:text-foreground">
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Registrar pago</h1>
        <p className="text-muted">Efectivo o transferencia. El pack se acredita en el momento.</p>
      </div>

      {!packs?.length ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          Primero creá un pack en{" "}
          <Link href="/panel/packs/nuevo" className="font-medium underline">
            Packs
          </Link>
          .
        </p>
      ) : !students?.length ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          Primero cargá un alumno en{" "}
          <Link href="/panel/alumnos/nuevo" className="font-medium underline">
            Alumnos
          </Link>
          .
        </p>
      ) : (
        <PaymentForm
          action={registerPayment.bind(null, slug)}
          initialStudentId={initialStudentId}
          students={students.map((s) => ({ id: s.id, name: s.full_name, detail: s.email ?? s.phone }))}
          packs={packs.map((p) => ({
            id: p.id,
            name: p.name,
            priceCents: p.price_cents,
            summary: packSummary(p.credits, p.validity_days),
            isCouple: p.is_couple,
          }))}
        />
      )}
    </div>
  );
}
