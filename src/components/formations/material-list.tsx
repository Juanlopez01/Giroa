import { ExternalLink, FileText, Image as ImageIcon, Link2, Music } from "lucide-react";
import { formatBytes, materialKind, type MaterialKind } from "@/lib/materials";

export type MaterialRow = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  mime_type: string | null;
  size_bytes: number | null;
  session_id: string | null;
  /** Link del material o URL firmada del archivo. */
  href: string | null;
};

const ICONS: Record<MaterialKind, typeof FileText> = { pdf: FileText, image: ImageIcon, audio: Music, link: Link2 };
const KIND_LABEL: Record<MaterialKind, string> = { pdf: "PDF", image: "Imagen", audio: "Audio", link: "Link" };

/**
 * Material agrupado: primero el de toda la formación, después el de cada
 * encuentro (en el orden de los encuentros). Lo usan el panel y "Mi formación".
 */
export function MaterialList({
  materials,
  sessions,
  empty,
  renderAction,
}: {
  materials: MaterialRow[];
  sessions: { id: string; label: string }[];
  empty: string;
  renderAction?: (m: MaterialRow) => React.ReactNode;
}) {
  if (!materials.length) return <p className="rounded-2xl border border-dashed border-border p-5 text-center text-muted">{empty}</p>;

  const groups = [
    { key: "general", label: "De toda la formación", items: materials.filter((m) => !m.session_id) },
    ...sessions.map((s) => ({ key: s.id, label: s.label, items: materials.filter((m) => m.session_id === s.id) })),
  ].filter((g) => g.items.length);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-xs font-medium tracking-widest text-muted uppercase">{g.label}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {g.items.map((m) => {
              const kind = materialKind(m);
              const Icon = ICONS[kind];
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    {m.href ? (
                      <a href={m.href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium hover:underline">
                        <span className="truncate">{m.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                      </a>
                    ) : (
                      <p className="truncate font-medium">{m.title}</p>
                    )}
                    <p className="truncate text-sm text-muted">
                      {KIND_LABEL[kind]}
                      {m.size_bytes ? ` · ${formatBytes(m.size_bytes)}` : ""}
                      {m.description ? ` · ${m.description}` : ""}
                    </p>
                  </div>
                  {renderAction ? <div className="shrink-0">{renderAction(m)}</div> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
