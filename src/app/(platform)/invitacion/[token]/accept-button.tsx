"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/errors";

export function AcceptButton({ accept }: { accept: () => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  return (
    <div className="space-y-3">
      <Button type="button" disabled={pending} onClick={() => startTransition(async () => setResult(await accept()))}>
        {pending ? "Sumándote…" : "Aceptar e ir al panel"}
      </Button>
      {result && !result.ok ? <FormMessage ok={false} message={result.message} /> : null}
    </div>
  );
}
