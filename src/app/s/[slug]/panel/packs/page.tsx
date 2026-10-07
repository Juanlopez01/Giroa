import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { formatArs } from "@/lib/money";
import { packSummary } from "@/lib/packs.server";
import { FormMessage } from "@/components/ui/field";

export const metadata: Metadata = { title: "Packs" };

export default async function PacksPage({ params, searchParams }: PageProps<"/s/[slug]/panel/packs">) {
  const { slug } = await params;
  const created = (await searchParams).nuevo === "1";
  const { studio, isAdmin } = await requireStaff(slug, "/panel/packs");
  const supabase = await createClient();

  const { data: packs } = await supabase
    .from("pack_products")
    .select("id, name, credits, validity_days, price_cents, is_couple, is_active")
    .eq("studio_id", studio.id)
    .order("is_active", { ascending: false })
    .order("sort")
    .order("price_cents");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Packs</h1>
        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-3">
          <Link href="/panel/packs/cupones" className="text-sm font-medium text-brand">
            Cupones
          </Link>
          <Link
            href="/panel/packs/nuevo"
            className="inline-flex h-11 shrink-0 items-center rounded-xl bg-brand px-4 font-medium text-brand-foreground"
          >
            + Nuevo pack
          </Link>
          </div>
        ) : null}
      </div>

      {created ? <FormMessage ok message="¡Pack creado! Tus alumnos ya lo pueden ver." /> : null}

      {!packs?.length ? (
        <div className="space-y-2 text-muted">
          <p>Todavía no tenés packs.</p>
          <p className="text-sm">
            Un pack es lo que compran tus alumnos para reservar: por ejemplo &ldquo;8 clases, vence en 30 días&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {packs.map((p) => (
            <li key={p.id}>
              <Link
                href={isAdmin ? `/panel/packs/${p.id}` : "/panel/packs"}
                className={`flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-foreground ${p.is_active ? "" : "opacity-60"}`}
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.name}
                    {p.is_couple ? <span className="ml-2 text-xs font-normal text-muted">Pareja</span> : null}
                    {!p.is_active ? <span className="ml-2 text-xs font-normal text-muted">Pausado</span> : null}
                  </p>
                  <p className="text-sm text-muted">{packSummary(p.credits, p.validity_days)}</p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{formatArs(p.price_cents)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
