import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/student-app";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, formatTime, todayYmd, toYmd } from "@/lib/datetime";
import { CHECKIN_PATH, checkinPath, isCheckinCode, type CheckinOption, type CheckinResult } from "@/lib/checkin";
import { PresenceSuccess } from "@/components/student/presence-success";
import { PresenceChoices } from "@/components/student/presence-choices";
import { PresenceScanner } from "@/components/student/presence-scanner";
import { checkInAt } from "./actions";

export const metadata: Metadata = { title: "Presente" };

// Qué ofrecer según el error de negocio de self_check_in.
const ERROR_CTA: Record<string, { href: string; label: string }> = {
  no_credits: { href: "/app/packs", label: "Comprar un pack" },
  no_session_now: { href: "/app/clases", label: "Ver los horarios" },
  outside_window: { href: "/app/clases", label: "Ver los horarios" },
  in_debt: { href: "/app", label: "Ver mi formación" },
  session_full: { href: "/app/clases", label: "Ver otras clases" },
};

// El alumno escaneó el cartel del estudio (…/app/presente?c=<código>) con la
// cámara del celu o con el escáner de la app. Sin código: se abre el escáner.
export default async function PresencePage({ params, searchParams }: PageProps<"/s/[slug]/app/presente">) {
  const { slug } = await params;
  const raw = (await searchParams).c;
  const code = typeof raw === "string" ? raw.toLowerCase() : null;

  if (!code) {
    await requireStudent(slug, CHECKIN_PATH);
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold">Dar el presente</h1>
          <p className="text-muted">Escaneá el QR que está en el estudio.</p>
        </div>
        <PresenceScanner />
      </div>
    );
  }
  if (!isCheckinCode(code)) return <Problem message="Este QR no es el del estudio. Buscá el cartel de asistencia." />;

  const { studio } = await requireStudent(slug, checkinPath(code));
  const tz = studio.timezone;
  const today = todayYmd(tz);
  const when = (iso: string) => {
    const day = toYmd(new Date(iso), tz);
    return `${day === today ? "Hoy" : formatDayLabel(day)} · ${formatTime(iso, tz)}`;
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("self_check_in", { p_code: code });
  if (error) {
    const cta = error.code === "P0001" ? ERROR_CTA[error.hint ?? ""] : undefined;
    if (error.code !== "P0001") console.error("[presente]", error);
    return <Problem message={error.code === "P0001" ? error.message : "Algo salió mal. Probá de nuevo en un rato."} cta={cta} />;
  }

  const result = data as unknown as CheckinResult;
  if (!("options" in result)) {
    return (
      <PresenceSuccess
        title={result.title}
        when={when(result.starts_at)}
        already={result.status === "already"}
        formation={result.kind === "formation"}
      />
    );
  }

  return (
    <PresenceChoices
      mode={result.status}
      options={result.options.map((o: CheckinOption) => ({
        sessionId: o.session_id,
        title: o.title,
        when: when(o.starts_at),
        kind: o.kind,
        booked: o.booked,
      }))}
      checkIn={checkInAt.bind(null, slug, code)}
    />
  );
}

function Problem({ message, cta }: { message: string; cta?: { href: string; label: string } }) {
  return (
    <div className="space-y-5 pt-6 text-center">
      <p className="font-serif text-3xl font-semibold">No pudimos darte el presente</p>
      <p className="text-muted">{message}</p>
      {cta ? (
        <Link href={cta.href} className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-medium text-brand-foreground">
          {cta.label}
        </Link>
      ) : null}
      <p className="text-sm text-muted">Si algo no está bien, avisale al profe: puede darte el presente a mano.</p>
    </div>
  );
}
