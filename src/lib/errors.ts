// Resultado de las server actions que devuelven feedback al formulario.
export type ActionState = {
  ok: boolean;
  /** Mensaje para mostrar arriba del formulario. */
  message?: string;
  /** Código estable del error de negocio (hint de private.fail). */
  code?: string;
  /** Errores por campo. */
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

const GENERIC_ERROR = "Algo salió mal. Probá de nuevo en un rato.";

type PostgrestLikeError = { code?: string; message?: string; hint?: string | null };

/**
 * Traduce un error de Supabase a algo mostrable. Los errores de negocio
 * (private.fail → SQLSTATE P0001) ya traen el mensaje en español; el resto se
 * loguea y se muestra un mensaje genérico (nunca detalles internos).
 */
export function fromSupabaseError(error: PostgrestLikeError, context: string): ActionState {
  if (error.code === "P0001" && error.message) {
    return { ok: false, message: error.message, code: error.hint ?? undefined };
  }
  console.error(`[${context}]`, error);
  return { ok: false, message: GENERIC_ERROR };
}

export function fieldErrorsFromZod(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
