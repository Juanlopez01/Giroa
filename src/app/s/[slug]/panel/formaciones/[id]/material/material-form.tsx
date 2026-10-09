"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FileUp, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/errors";
import {
  formatBytes,
  MATERIAL_ACCEPT,
  MATERIAL_MAX_BYTES,
  MATERIAL_MIME_TYPES,
  MATERIALS_BUCKET,
  materialPath,
} from "@/lib/materials";

type Uploaded = { path: string; mime: string; size: number; name: string };

/**
 * Agregar material: un archivo (lo sube el navegador directo a Storage, así no
 * pasa por el límite de tamaño del servidor) o un link. Después se guarda la fila.
 */
export function MaterialForm({
  action,
  studioId,
  formationId,
  sessions,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  studioId: string;
  formationId: string;
  sessions: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [kind, setKind] = useState<"file" | "link">("file");
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [round, setRound] = useState(0);
  const lastOk = useRef<ActionState | null>(null);
  const errors: Record<string, string | undefined> = { ...(state.fieldErrors ?? {}), ...(uploadError ? { file: uploadError } : {}) };

  // Después de guardar, el formulario queda limpio para cargar el siguiente.
  useEffect(() => {
    if (state.ok && state !== lastOk.current) {
      lastOk.current = state;
      setUploaded(null);
      setTitle("");
      setRound((r) => r + 1);
    }
  }, [state]);

  async function onFile(file: File | undefined) {
    setUploadError(null);
    setUploaded(null);
    if (!file) return;
    if (!(MATERIAL_MIME_TYPES as readonly string[]).includes(file.type)) {
      setUploadError("Ese tipo de archivo no se puede subir: usá PDF, imagen (PNG, JPG, WEBP) o audio (MP3, M4A, WAV, OGG).");
      return;
    }
    if (file.size > MATERIAL_MAX_BYTES) {
      setUploadError("El archivo pesa más de 50 MB. Para videos o archivos grandes, pegá un link de YouTube o Drive.");
      return;
    }
    setUploading(true);
    const path = materialPath(studioId, formationId, file.name);
    const { error } = await createClient().storage.from(MATERIALS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) {
      setUploadError("No pudimos subir el archivo. Probá de nuevo.");
      return;
    }
    setUploaded({ path, mime: file.type, size: file.size, name: file.name });
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  const tab = (k: "file" | "link", label: string, Icon: typeof FileUp) => (
    <button
      type="button"
      onClick={() => setKind(k)}
      aria-pressed={kind === k}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted aria-pressed:bg-brand aria-pressed:text-brand-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </button>
  );

  return (
    <ActionForm key={round} action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="inline-flex rounded-full bg-border/40 p-1">
        {tab("file", "Archivo", FileUp)}
        {tab("link", "Link", Link2)}
      </div>
      <input type="hidden" name="kind" value={kind} />

      {kind === "file" ? (
        <Field label="Archivo" hint="PDF, imagen o audio, hasta 50 MB." error={errors.file ?? errors.storagePath ?? errors.mimeType ?? errors.sizeBytes}>
          <Input type="file" accept={MATERIAL_ACCEPT} onChange={(e) => onFile(e.target.files?.[0])} disabled={uploading} />
          {uploading ? <p className="text-sm text-muted">Subiendo…</p> : null}
          {uploaded ? (
            <p className="text-sm text-success">
              ✓ {uploaded.name} · {formatBytes(uploaded.size)}
            </p>
          ) : null}
          <input type="hidden" name="storagePath" value={uploaded?.path ?? ""} />
          <input type="hidden" name="mimeType" value={uploaded?.mime ?? ""} />
          <input type="hidden" name="sizeBytes" value={uploaded?.size ?? ""} />
        </Field>
      ) : (
        <Field label="Link" hint="YouTube, Google Drive, Spotify… Que se pueda abrir con el link." error={errors.url}>
          <Input name="url" type="url" inputMode="url" placeholder="https://" />
        </Field>
      )}

      <Field label="Título" error={errors.title}>
        <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Apunte 1 · Técnica de giros" />
      </Field>
      <Field label="Descripción" hint="Opcional" error={errors.description}>
        <Textarea name="description" rows={2} maxLength={1000} />
      </Field>
      {sessions.length ? (
        <Field label="¿De qué encuentro?" hint="Opcional: si no elegís, es de toda la formación.">
          <Select name="sessionId" defaultValue="">
            <option value="">De toda la formación</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" disabled={pending || uploading || (kind === "file" && !uploaded)}>
        {pending ? "Guardando…" : kind === "file" ? "Guardar archivo" : "Guardar link"}
      </Button>
    </ActionForm>
  );
}
