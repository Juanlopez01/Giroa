import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { balancesByStudent } from "@/lib/students.server";
import { INCOME_KIND_LABELS, listIncome } from "@/lib/income.server";
import { csvMoney, toCsv } from "@/lib/csv";
import { formatTime, startOfDay, todayYmd, toYmd } from "@/lib/datetime";
import { ROLE_LABELS } from "@/lib/disciplines";

// Exportar para Excel (los datos son del estudio): alumnos con su saldo, o los
// cobros de un mes (?mes=AAAA-MM) o de todo (?mes=todo). Solo dueño/encargado.
const METHOD_LABELS = { cash: "Efectivo", transfer: "Transferencia", mercadopago: "Mercado Pago" } as const;

function file(name: string, csv: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest, { params }: RouteContext<"/s/[slug]/panel/exportar/[tipo]">) {
  const { slug, tipo } = await params;
  const { studio } = await requireAdmin(slug, "/panel");
  const tz = studio.timezone;
  const today = todayYmd(tz);

  if (tipo === "alumnos") {
    const supabase = await createClient();
    const [{ data: students }, balances] = await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, email, phone, default_role, is_active, user_id, created_at")
        .eq("studio_id", studio.id)
        .order("full_name")
        .limit(10000),
      balancesByStudent(studio.id),
    ]);
    const rows = (students ?? []).map((s) => {
      const b = balances.get(s.id);
      return [
        s.full_name,
        s.email,
        s.phone,
        s.default_role ? ROLE_LABELS[s.default_role] : "",
        s.is_active,
        Boolean(s.user_id),
        b ? (b.unlimited ? "Libre" : b.credits) : 0,
        b?.nextExpiry ?? "",
        toYmd(new Date(s.created_at), tz),
      ];
    });
    const csv = toCsv(
      ["Nombre", "Email", "Celular", "Rol", "Activo", "Usa la app", "Clases disponibles", "Vence", "Alta"],
      rows,
    );
    return file(`alumnos-${studio.slug}-${today}.csv`, csv);
  }

  if (tipo === "pagos") {
    const mes = request.nextUrl.searchParams.get("mes") ?? today.slice(0, 7);
    const all = mes === "todo";
    if (!all && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return new NextResponse("Mes inválido.", { status: 400 });
    const from = all ? new Date("2020-01-01T00:00:00Z") : startOfDay(`${mes}-01`, tz);
    const to = all ? new Date(Date.now() + 86_400_000) : startOfDay(`${shiftMonth(mes, 1)}-01`, tz);
    const items = await listIncome(studio.id, from, to);
    const rows = items.map((i) => {
      const at = new Date(i.paidAt);
      return [
        toYmd(at, tz),
        formatTime(at, tz),
        INCOME_KIND_LABELS[i.kind],
        i.who,
        i.what,
        METHOD_LABELS[i.method],
        csvMoney(i.amountCents),
        i.note,
      ];
    });
    const csv = toCsv(["Fecha", "Hora", "Tipo", "Quién", "Qué", "Medio", "Monto", "Nota"], rows);
    return file(`cobros-${studio.slug}-${all ? "todo" : mes}.csv`, csv);
  }

  return new NextResponse("No encontramos ese archivo.", { status: 404 });
}
