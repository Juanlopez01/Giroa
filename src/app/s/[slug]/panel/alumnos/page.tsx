import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { balancesByStudent, formatBalance } from "@/lib/students.server";

export const metadata: Metadata = { title: "Alumnos" };

const PAGE_SIZE = 200;

export default async function StudentsPage({ params, searchParams }: PageProps<"/s/[slug]/panel/alumnos">) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const showInactive = sp.inactivos === "1";
  const { studio, isAdmin } = await requireStaff(slug, "/panel/alumnos");
  const supabase = await createClient();

  let query = supabase
    .from("students")
    .select("id, full_name, email, phone, user_id, is_active", { count: "exact" })
    .eq("studio_id", studio.id)
    .eq("is_active", !showInactive)
    .order("full_name")
    .limit(PAGE_SIZE);
  if (q) {
    // Escapa los comodines de LIKE y las comas del filtro or().
    const term = q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const [{ data: students, count }, balances] = await Promise.all([query, balancesByStudent(studio.id)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Alumnos</h1>
        <div className="flex gap-2">
          {isAdmin ? (
            <Link
              href="/panel/alumnos/importar"
              className="inline-flex h-11 items-center rounded-xl border border-border bg-surface px-4 font-medium"
            >
              Importar
            </Link>
          ) : null}
          <Link
            href="/panel/alumnos/nuevo"
            className="inline-flex h-11 items-center rounded-xl bg-brand px-4 font-medium text-brand-foreground"
          >
            + Alumno
          </Link>
        </div>
      </div>

      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, email o teléfono"
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-brand"
        />
        {showInactive ? <input type="hidden" name="inactivos" value="1" /> : null}
        <button type="submit" className="h-12 rounded-xl border border-border bg-surface px-4 font-medium">
          Buscar
        </button>
      </form>

      {!students?.length ? (
        <p className="text-muted">
          {q ? "No encontramos alumnos con esa búsqueda." : showInactive ? "No hay alumnos inactivos." : "Todavía no cargaste alumnos."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {students.map((s) => {
            const balance = balances.get(s.id);
            return (
              <li key={s.id}>
                <Link href={`/panel/alumnos/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-background">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.full_name}
                      {s.user_id ? <span className="ml-2 text-xs font-normal text-success">Usa la app</span> : null}
                    </p>
                    <p className="truncate text-sm text-muted">{s.email ?? s.phone ?? "Sin contacto"}</p>
                  </div>
                  <p className={`shrink-0 text-right text-sm ${balance ? "" : "text-muted"}`}>{formatBalance(balance)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {count ?? 0} {count === 1 ? "alumno" : "alumnos"}
          {count && count > PAGE_SIZE ? ` (se muestran ${PAGE_SIZE}; usá la búsqueda)` : ""}
        </span>
        <Link href={showInactive ? "/panel/alumnos" : "/panel/alumnos?inactivos=1"} className="hover:text-foreground">
          {showInactive ? "Ver activos" : "Ver inactivos"}
        </Link>
      </div>
    </div>
  );
}
