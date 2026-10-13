import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { csvMoney, toCsv } from "@/lib/csv";
import { formatTime, todayYmd, toYmd } from "@/lib/datetime";
import { parseMonth } from "@/lib/payouts";
import { loadMonthPayouts } from "@/lib/payouts.server";

// Liquidación del mes para Excel (?mes=AAAA-MM): una fila por clase y profe.
export async function GET(request: NextRequest, { params }: RouteContext<"/s/[slug]/panel/liquidaciones/exportar">) {
  const { slug } = await params;
  const { studio } = await requireAdmin(slug, "/panel/liquidaciones");
  if (!(await can(studio.id, "teacher_payouts"))) return NextResponse.json({ error: "feature" }, { status: 403 });

  const tz = studio.timezone;
  const month = parseMonth(request.nextUrl.searchParams.get("mes")) ?? todayYmd(tz).slice(0, 7);
  const { payees, paid } = await loadMonthPayouts(studio.id, month, tz);

  const rows = payees.flatMap((p) =>
    p.lines.map((l) => [
      p.name,
      toYmd(new Date(l.startsAt), tz),
      formatTime(l.startsAt, tz),
      l.title,
      l.present,
      csvMoney(l.revenueCents),
      l.rule,
      csvMoney(l.earnedCents),
      paid.has(p.key) ? "Sí" : "No",
    ]),
  );
  const csv = toCsv(["Profe", "Fecha", "Hora", "Clase", "Presentes", "Generó", "Cómo cobra", "Le toca", "Pagado"], rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="liquidacion-profes-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
