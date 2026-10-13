import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/panel";
import { can } from "@/lib/gating";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel, toYmd } from "@/lib/datetime";
import { UpgradeNotice } from "@/components/panel/upgrade-notice";
import { SmallAction } from "../../../equipo/team-controls";
import { issueAllCertificates, issueCertificate, revokeCertificate, saveCertificateSettings } from "./actions";
import { CertificateSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Certificados" };

export default async function FormationCertificatesPage({ params }: PageProps<"/s/[slug]/panel/formaciones/[id]/certificados">) {
  const { slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { studio } = await requireAdmin(slug, `/panel/formaciones/${id}/certificados`);
  if (!(await can(studio.id, "certificates"))) return <UpgradeNotice feature="certificates" what="Los certificados" />;
  const tz = studio.timezone;
  const supabase = await createClient();

  const [{ data: f }, { data: rows }] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, certificate_signer_name, certificate_signer_role, certificate_text")
      .eq("id", id)
      .eq("studio_id", studio.id)
      .maybeSingle(),
    supabase.rpc("certificate_status", { p_formation_id: id }),
  ]);
  if (!f) notFound();

  const list = rows ?? [];
  const pendingEligible = list.filter((r) => r.eligible && (!r.certificate_id || r.revoked_at)).length;
  const issued = list.filter((r) => r.certificate_id && !r.revoked_at).length;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link href={`/panel/formaciones/${f.id}`} className="text-sm text-muted hover:text-foreground">
          ← {f.title}
        </Link>
        <h1 className="text-2xl font-semibold">Certificados</h1>
        <p className="text-muted">
          Cumple quien llegó a la asistencia mínima, aprobó las evaluaciones y no debe cuotas. Le llega por mail, lo descarga
          en PDF desde su app y cualquiera lo puede verificar con el QR.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Firma y texto</h2>
        <CertificateSettingsForm
          action={saveCertificateSettings.bind(null, slug, f.id)}
          initial={{
            signerName: f.certificate_signer_name ?? "",
            signerRole: f.certificate_signer_role ?? "",
            text: f.certificate_text ?? "",
          }}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Inscriptos</h2>
            <p className="text-sm text-muted">
              {issued} {issued === 1 ? "emitido" : "emitidos"} · {pendingEligible} {pendingEligible === 1 ? "cumple y espera" : "cumplen y esperan"}
            </p>
          </div>
          {pendingEligible ? (
            <SmallAction
              run={issueAllCertificates.bind(null, slug, f.id)}
              label={`Emitir a los ${pendingEligible === 1 ? "que cumple" : `${pendingEligible} que cumplen`}`}
              confirmText={`¿Emitir ${pendingEligible === 1 ? "1 certificado" : `${pendingEligible} certificados`}? Les llega un mail a cada uno.`}
            />
          ) : null}
        </div>

        {list.length === 0 ? (
          <p className="text-muted">Todavía no hay inscriptos.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {list.map((r) => {
              const active = r.certificate_id && !r.revoked_at;
              const reasons = Array.isArray(r.reasons) ? (r.reasons as string[]) : [];
              return (
                <li key={r.enrollment_id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{r.student_name}</p>
                      <p className="text-sm text-muted">Asistencia {r.attendance_pct}%</p>
                    </div>
                    {active ? (
                      <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Emitido</span>
                    ) : r.revoked_at ? (
                      <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted">Anulado</span>
                    ) : r.eligible ? (
                      <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">Cumple</span>
                    ) : null}
                  </div>

                  {!active && reasons.length ? (
                    <ul className="list-inside list-disc text-sm text-muted">
                      {reasons.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {active ? (
                      <>
                        <span className="text-muted">
                          {formatDayLabel(toYmd(new Date(r.issued_at!), tz))}
                          {r.forced ? " · sin cumplir todo" : ""}
                        </span>
                        <a href={`/certificado/${r.code}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand">
                          Ver
                        </a>
                        <a href={`/certificado/${r.code}/pdf`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand">
                          PDF
                        </a>
                        <SmallAction
                          run={revokeCertificate.bind(null, slug, f.id, r.certificate_id!)}
                          label="Anular"
                          confirmText={`¿Anular el certificado de ${r.student_name}? El link y el QR van a decir que está anulado.`}
                          danger
                        />
                      </>
                    ) : r.eligible ? (
                      <SmallAction run={issueCertificate.bind(null, slug, f.id, r.enrollment_id, false)} label={r.revoked_at ? "Emitir de nuevo" : "Emitir"} />
                    ) : (
                      <SmallAction
                        run={issueCertificate.bind(null, slug, f.id, r.enrollment_id, true)}
                        label="Emitir igual"
                        confirmText={`${r.student_name} no cumple todos los requisitos. ¿Emitirle el certificado igual?`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
