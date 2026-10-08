import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { studioUrl } from "@/lib/urls";
import { bookingIcs } from "@/lib/ics";

// "Agregar a mi calendario": descarga el .ics de una reserva propia.
export async function GET(_request: Request, { params }: RouteContext<"/s/[slug]/app/reservas/[id]/calendario">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("No encontramos esa reserva.", { status: 404 });
  const { studio, student } = await requireStudent(slug, "/app/reservas");

  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("id, sessions!inner(starts_at, ends_at, offerings(title))")
    .eq("id", id)
    .eq("student_id", student.id)
    .maybeSingle();
  if (!b) return new NextResponse("No encontramos esa reserva.", { status: 404 });

  const ics = bookingIcs({
    uid: b.id,
    title: b.sessions.offerings?.title ?? "Clase",
    studioName: studio.name,
    startsAt: b.sessions.starts_at,
    endsAt: b.sessions.ends_at,
    url: studioUrl(slug, "/app/reservas"),
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="clase-${b.id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
