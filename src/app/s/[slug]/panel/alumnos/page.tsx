import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Search } from "lucide-react";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { balancesByStudent, formatBalance, type BalanceSummary } from "@/lib/students.server";
import { addDaysYmd, nowMs, todayYmd } from "@/lib/datetime";

export const metadata: Metadata = { title: "Alumnos" };

const PAGE_SIZE = 200;

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "sin-saldo", label: "Sin saldo" },
  { key: "vencen", label: "Vencen pronto" },
  { key: "app", label: "Usan la app" },
  { key: "inactivos", label: "Inactivos" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function BalanceChip({ balance, soonYmd }: { balance: BalanceSummary | undefined; soonYmd: string }) {
  if (!balance) return <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-danger">Sin saldo</span>;
  const soon = balance.nextExpiry !== null && balance.nextExpiry <= soonYmd;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        soon ? "bg-amber-100 text-amber-900" : "bg-brand/10 text-brand"
      }`}
    >
      {formatBalance(balance)}
    </span>
  );
}

export default async function StudentsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/alumnos">) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  // Compatibilidad con el link viejo ?inactivos=1.
  const rawFilter = sp.inactivos === "1" ? "inactivos" : typeof sp.filtro === "string" ? sp.filtro : "";
  const filter: FilterKey = FILTERS.some((f) => f.key === rawFilter) ? (rawFilter as FilterKey) : "";
  const { studio, isAdmin } = await requireStaff(slug, "/panel/alumnos");
  const supabase = await createClient();
  const soonYmd = addDaysYmd(todayYmd(studio.timezone, new Date(nowMs())), 7);

  let query = supabase
    .from("students")
    .select("id, full_name, email, phone, user_id, is_active", { count: "exact" })
    .eq("studio_id", studio.id)
    .eq("is_active", filter !== "inactivos")
    .order("full_name")
    .limit(filter && filter !== "inactivos" ? 2000 : PAGE_SIZE);
  if (filter === "app") query = query.not("user_id", "is", null);
  if (q) {
    // Escapa los comodines de LIKE y las comas del filtro or().
    const term = q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const [{ data: rows, count }, balances, usageRes] = await Promise.all([
    query,
    balancesByStudent(studio.id),
    isAdmin ? supabase.rpc("studio_usage", { p_studio_id: studio.id }) : Promise.resolve({ data: null }),
  ]);
  const usage = usageRes.data as { at_limit?: boolean; max_active_students?: number | null } | null;
  const atLimit = Boolean(usage?.at_limit);

  const students = (rows ?? []).filter((s) => {
    const b = balances.get(s.id);
    if (filter === "sin-saldo") return !b;
    if (filter === "vencen") return Boolean(b?.nextExpiry && b.nextExpiry <= soonYmd);
    return true;
  });
  const href = (f: FilterKey) => {
    const params = new URLSearchParams();
    if (f) params.set("filtro", f);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/panel/alumnos?${s}` : "/panel/alumnos";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Alumnos</h1>
        <div className="flex gap-2">
          {isAdmin ? (
            <>
              <a
                href="/panel/exportar/alumnos"
                download
                className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium"
              >
                Exportar
              </a>
              <Link href="/panel/alumnos/importar" className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium">
                Importar
              </Link>
            </>
          ) : null}
          {atLimit ? null : (
            <Link href="/panel/alumnos/nuevo" className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground">
              + Alumno
            </Link>
          )}
        </div>
      </div>

      {atLimit ? (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Llegaste al límite de {usage?.max_active_students} alumnos activos de tu plan. Para sumar alumnos nuevos, pasate
          a un plan mayor.
        </p>
      ) : null}

      {/* Buscador y filtros: quedan fijos arriba al bajar. */}
      <div className="sticky top-14 z-10 -mx-5 space-y-3 bg-background/90 px-5 py-2 backdrop-blur md:top-0 md:-mx-8 md:px-8">
        <form role="search" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, email o teléfono"
            className="h-11 w-full rounded-full border border-border bg-surface pr-4 pl-10 text-base outline-none focus:border-brand"
          />
          {filter ? <input type="hidden" name="filtro" value={filter} /> : null}
        </form>
        <nav aria-label="Filtros" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <Link
              key={f.key || "todos"}
              href={href(f.key)}
              aria-current={filter === f.key ? "page" : undefined}
              className={`h-8 shrink-0 rounded-full px-3.5 text-sm leading-8 font-medium ${
                filter === f.key ? "bg-brand text-brand-foreground" : "bg-border/50 text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      {!students.length ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-muted">
          {q
            ? "No encontramos alumnos con esa búsqueda."
            : filter === "inactivos"
              ? "No hay alumnos inactivos."
              : filter
                ? "Nadie en este grupo. ¡Bien ahí!"
                : "Todavía no cargaste alumnos."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {students.map((s) => (
            <li key={s.id}>
              <Link href={`/panel/alumnos/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                <Avatar name={s.full_name} online={Boolean(s.user_id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.full_name}</span>
                  <span className="block truncate text-sm text-muted">{s.email ?? s.phone ?? "Sin contacto"}</span>
                </span>
                <BalanceChip balance={balances.get(s.id)} soonYmd={soonYmd} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted">
        {filter === "sin-saldo" || filter === "vencen" ? students.length : (count ?? 0)} {(count ?? 0) === 1 ? "alumno" : "alumnos"}
        {!filter && count && count > PAGE_SIZE ? ` (se muestran ${PAGE_SIZE}; usá la búsqueda)` : ""}
        {" · "}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> usa la app
        </span>
      </p>
    </div>
  );
}
