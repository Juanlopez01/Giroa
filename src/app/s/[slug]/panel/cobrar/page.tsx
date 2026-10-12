import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Search } from "lucide-react";
import { requireStaff } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/gating";
import { formatArs } from "@/lib/money";
import { formatDayLabel, formatTime, nowMs, toYmd } from "@/lib/datetime";
import { pendingCharges } from "@/lib/charge.server";
import { Avatar } from "@/components/ui/avatar";
import { Field, Input, Select } from "@/components/ui/field";
import { ChargeForm, PayPendingButtons } from "./charge-form";
import { payPending, sellClass, sellGift, sellPack, sellPackToNewStudent, sellTickets } from "./actions";

export const metadata: Metadata = { title: "Cobrar" };

type Tab = "pack" | "nuevo" | "clase" | "entrada" | "regalo";
const TAB_LABEL: Record<Tab, string> = { pack: "Pack", nuevo: "Pack (alumno nuevo)", clase: "Clase suelta", entrada: "Entrada", regalo: "Gift card" };
const EXTERNAL = "externo";

export default async function ChargePage({ params, searchParams }: PageProps<"/s/[slug]/panel/cobrar">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { studio, canTakePayments } = await requireStaff(slug, "/panel/cobrar");
  const tz = studio.timezone;

  if (!canTakePayments) {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <h1 className="font-serif text-3xl font-semibold">Cobrar</h1>
        <p className="text-muted">Tu usuario no tiene permiso para cobrar. Pedíselo al dueño del estudio (Panel → Equipo).</p>
      </div>
    );
  }

  const supabase = await createClient();
  const rawAlumno = typeof sp.alumno === "string" ? sp.alumno : "";
  const external = rawAlumno === EXTERNAL;
  const studentId = z.uuid().safeParse(rawAlumno).success ? rawAlumno : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  // ---------------------------------------------------------------- 1. ¿a quién?
  if (!studentId && !external) {
    let results: { id: string; full_name: string; email: string | null; phone: string | null }[] = [];
    if (q) {
      const term = q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ");
      const { data } = await supabase
        .from("students")
        .select("id, full_name, email, phone")
        .eq("studio_id", studio.id)
        .eq("is_active", true)
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
        .order("full_name")
        .limit(20);
      results = data ?? [];
    }
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold">Cobrar</h1>
          <p className="text-muted">Packs, clases sueltas, entradas, gift cards y lo que deban, todo desde acá.</p>
        </div>
        <form role="search" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="¿A quién? Buscá por nombre, email o teléfono"
            className="h-12 w-full rounded-full border border-border bg-surface pr-4 pl-10 text-base outline-none focus:border-brand"
          />
        </form>
        {q ? (
          results.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {results.map((s) => (
                <li key={s.id}>
                  <Link href={`/panel/cobrar?alumno=${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                    <Avatar name={s.full_name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.full_name}</span>
                      <span className="block truncate text-sm text-muted">{s.email ?? s.phone ?? "Sin contacto"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">
              No encontramos a nadie con “{q}”.{" "}
              <Link href="/panel/alumnos/nuevo" className="font-medium text-brand underline">
                Cargar alumno nuevo
              </Link>
            </p>
          )
        ) : null}
        <Link
          href={`/panel/cobrar?alumno=${EXTERNAL}`}
          className="block rounded-2xl border border-dashed border-border p-4 text-center text-sm font-medium text-muted hover:border-brand hover:text-brand"
        >
          Alguien que no es alumno (entradas o gift cards)
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------- 2. ¿qué le cobrás?
  const now = new Date(nowMs());
  const [student, dropIn, specials, ticketsOn, giftsOn] = await Promise.all([
    studentId
      ? supabase.from("students").select("id, full_name, email, phone").eq("id", studentId).eq("studio_id", studio.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    can(studio.id, "drop_in"),
    can(studio.id, "specials"),
    can(studio.id, "event_tickets"),
    can(studio.id, "gift_cards"),
  ]);
  if (studentId && !student) notFound();

  const tabs: Tab[] = [
    ...(student ? (["pack"] as const) : (["nuevo"] as const)),
    ...(student && (dropIn || specials) ? (["clase"] as const) : []),
    ...(ticketsOn ? (["entrada"] as const) : []),
    ...(giftsOn ? (["regalo"] as const) : []),
  ];
  const tab: Tab = tabs.find((t) => t === sp.que) ?? tabs[0] ?? "pack";
  const base = `/panel/cobrar?alumno=${student?.id ?? EXTERNAL}`;

  const [pending, packs, partners, sessions, tickets] = await Promise.all([
    student ? pendingCharges(studio.id, student.id, tz) : Promise.resolve([]),
    tab === "pack" || tab === "nuevo" || tab === "regalo"
      ? supabase
          .from("pack_products")
          .select("id, name, price_cents, is_couple")
          .eq("studio_id", studio.id)
          .eq("is_active", true)
          .order("sort")
          .order("price_cents")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    tab === "pack" && student
      ? supabase
          .from("students")
          .select("id, full_name")
          .eq("studio_id", studio.id)
          .eq("is_active", true)
          .neq("id", student.id)
          .order("full_name")
          .limit(2000)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    tab === "clase"
      ? supabase
          .from("sessions")
          .select("id, starts_at, offerings!inner(title, kind, price_cents, role_balance_max_diff)")
          .eq("studio_id", studio.id)
          .eq("status", "scheduled")
          .gte("starts_at", new Date(now.getTime() - 2 * 3_600_000).toISOString())
          .lte("starts_at", new Date(now.getTime() + 7 * 86_400_000).toISOString())
          .not("offerings.price_cents", "is", null)
          .order("starts_at")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    tab === "entrada"
      ? supabase
          .from("event_ticket_types")
          .select("id, name, price_cents, events!event_ticket_types_studio_id_event_id_fkey!inner(title, starts_at, status)")
          .eq("studio_id", studio.id)
          .eq("is_active", true)
          .eq("events.status", "published")
          .gte("events.starts_at", new Date(now.getTime() - 12 * 3_600_000).toISOString())
          .order("sort")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  const couplePacks = packs.some((p) => p.is_couple);
  const when = (iso: string) => `${formatDayLabel(toYmd(new Date(iso), tz))} ${formatTime(iso, tz)}`;
  const buyerFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre de quien compra">
        <Input name="buyerName" defaultValue={student?.full_name ?? ""} required />
      </Field>
      <Field label="Email" hint="Opcional: le llega por mail.">
        <Input name="buyerEmail" type="email" defaultValue={student?.email ?? ""} />
      </Field>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-3">
        <Link href="/panel/cobrar" className="text-sm text-muted hover:text-foreground">
          ← Cambiar de persona
        </Link>
        {student ? (
          <div className="flex items-center gap-3">
            <Avatar name={student.full_name} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate font-serif text-2xl font-semibold">{student.full_name}</h1>
              <Link href={`/panel/alumnos/${student.id}`} className="text-sm text-muted hover:text-foreground">
                Ver ficha
              </Link>
            </div>
          </div>
        ) : (
          <h1 className="font-serif text-2xl font-semibold">Venta a alguien que no es alumno</h1>
        )}
      </div>

      {pending.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Tiene pendiente</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
            {pending.map((p) => (
              <li key={`${p.kind}-${p.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-sm text-muted">
                    {formatArs(p.amountCents)} · {p.detail}
                  </p>
                </div>
                <PayPendingButtons pay={payPending.bind(null, slug, p.kind, p.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tabs.length ? (
        <section className="space-y-4">
          <h2 className="text-xs font-medium tracking-widest text-muted uppercase">{pending.length ? "O venderle" : "¿Qué le vendés?"}</h2>
          <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0">
            {tabs.map((t) => (
              <Link
                key={t}
                href={`${base}&que=${t}`}
                aria-current={t === tab ? "page" : undefined}
                className={`h-9 shrink-0 rounded-full px-4 text-sm leading-9 font-medium ${
                  t === tab ? "bg-brand text-brand-foreground" : "bg-border/50 text-muted hover:text-foreground"
                }`}
              >
                {TAB_LABEL[t]}
              </Link>
            ))}
          </nav>

          <div className="rounded-2xl border border-border bg-surface p-5">
            {tab === "pack" && student ? (
              packs.length ? (
                <ChargeForm action={sellPack.bind(null, slug, student.id)} submitLabel="Cobrar y cargar el pack">
                  <Field label="Pack">
                    <Select name="packId" defaultValue="" required>
                      <option value="" disabled>
                        Elegí el pack
                      </option>
                      {packs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {formatArs(p.price_cents)}
                          {p.is_couple ? " · pareja" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {couplePacks ? (
                    <Field label="Pareja" hint="Solo para packs de pareja: comparten el saldo.">
                      <Select name="partnerId" defaultValue="">
                        <option value="">Sin pareja</option>
                        {partners.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  <Field label="Monto cobrado" hint="Opcional: si no ponés nada, es el precio del pack.">
                    <Input name="amount" inputMode="decimal" placeholder="Precio del pack" />
                  </Field>
                  <Field label="Nota" hint="Opcional">
                    <Input name="notes" maxLength={1000} />
                  </Field>
                </ChargeForm>
              ) : (
                <p className="text-muted">
                  No tenés packs activos.{" "}
                  <Link href="/panel/packs/nuevo" className="font-medium text-brand underline">
                    Crear un pack
                  </Link>
                </p>
              )
            ) : null}

            {tab === "nuevo" && !student ? (
              packs.length ? (
                <ChargeForm action={sellPackToNewStudent.bind(null, slug)} submitLabel="Darlo de alta y cobrar">
                  <p className="text-sm text-muted">
                    Lo damos de alta con su email y le llegan dos mails: uno para entrar a la app (sin contraseña) y otro con su pack.
                    Si ese email ya es de un alumno, le cargamos el pack a esa ficha.
                  </p>
                  <Field label="Nombre y apellido">
                    <Input name="fullName" required maxLength={120} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Email">
                      <Input name="email" type="email" inputMode="email" required />
                    </Field>
                    <Field label="Celular" hint="Opcional">
                      <Input name="phone" type="tel" inputMode="tel" />
                    </Field>
                  </div>
                  <Field label="Pack">
                    <Select name="packId" defaultValue="" required>
                      <option value="" disabled>
                        Elegí el pack
                      </option>
                      {packs
                        .filter((p) => !p.is_couple)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {formatArs(p.price_cents)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                </ChargeForm>
              ) : (
                <p className="text-muted">No tenés packs activos.</p>
              )
            ) : null}

            {tab === "clase" && student ? (
              sessions.length ? (
                <ChargeForm action={sellClass.bind(null, slug, student.id)} submitLabel="Cobrar y reservar">
                  <Field label="Clase" hint="Las de hoy y los próximos 7 días con precio suelto.">
                    <Select name="sessionId" defaultValue="" required>
                      <option value="" disabled>
                        Elegí la clase
                      </option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {when(s.starts_at)} · {s.offerings.title} · {formatArs(s.offerings.price_cents ?? 0)}
                          {s.offerings.kind === "special" ? " · workshop" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {sessions.some((s) => s.offerings.role_balance_max_diff !== null) ? (
                    <Field label="Rol" hint="Solo en clases con balance de roles.">
                      <Select name="role" defaultValue="">
                        <option value="">El de siempre</option>
                        <option value="leader">Líder</option>
                        <option value="follower">Seguidor/a</option>
                      </Select>
                    </Field>
                  ) : null}
                </ChargeForm>
              ) : (
                <p className="text-muted">
                  No hay clases con precio suelto en los próximos 7 días. El precio se pone en Panel → Clases (o en Workshops).
                </p>
              )
            ) : null}

            {tab === "entrada" ? (
              tickets.length ? (
                <ChargeForm action={sellTickets.bind(null, slug)} submitLabel="Cobrar las entradas">
                  <Field label="Entrada">
                    <Select name="ticketTypeId" defaultValue="" required>
                      <option value="" disabled>
                        Elegí el evento y la entrada
                      </option>
                      {tickets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.events.title} · {when(t.events.starts_at)} · {t.name} · {formatArs(t.price_cents)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Cantidad">
                    <Input name="quantity" type="number" inputMode="numeric" min={1} max={20} defaultValue={1} required />
                  </Field>
                  {buyerFields}
                </ChargeForm>
              ) : (
                <p className="text-muted">No hay eventos publicados con entradas a la venta.</p>
              )
            ) : null}

            {tab === "regalo" ? (
              packs.some((p) => !p.is_couple) ? (
                <ChargeForm action={sellGift.bind(null, slug)} submitLabel="Cobrar la gift card">
                  <Field label="Pack de regalo">
                    <Select name="packId" defaultValue="" required>
                      <option value="" disabled>
                        Elegí el pack
                      </option>
                      {packs
                        .filter((p) => !p.is_couple)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {formatArs(p.price_cents)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Para quién" hint="Opcional: el nombre que va en la tarjeta.">
                    <Input name="recipientName" maxLength={120} />
                  </Field>
                  {buyerFields}
                </ChargeForm>
              ) : (
                <p className="text-muted">
                  Para vender gift cards necesitás un pack individual activo (los de pareja no se regalan).
                </p>
              )
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
