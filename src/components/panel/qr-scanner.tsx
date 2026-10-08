"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

/** Lo que se muestra después de leer un QR. "warn" = válido pero con aviso (p. ej. ya ingresó). */
export type ScanFeedback = { kind: "ok" | "warn" | "error"; text: string };

type Status = { kind: "idle" | ScanFeedback["kind"]; text: string };

/**
 * Lector de QR con la cámara trasera. Lee cuadros del video, decodifica con
 * jsQR (anda en Android y iPhone) y se lo pasa a `scan` (una server action).
 * Necesita https (o localhost) para acceder a la cámara.
 */
export function QrScanner({
  scan,
  hint,
  autoOpen = false,
}: {
  scan: (code: string) => Promise<ScanFeedback>;
  hint: string;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [open, setOpen] = useState(autoOpen);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: hint });

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setStatus({
          kind: "error",
          text: "No pudimos abrir la cámara. Revisá el permiso del navegador (y que la página sea https).",
        });
        return;
      }
      if (cancelled || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});

      timer = setInterval(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || busyRef.current || video.readyState < 2) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (!qr?.data) return;

        // Ignora el mismo QR durante unos segundos (sigue en cámara).
        const now = Date.now();
        if (qr.data === lastRef.current.code && now - lastRef.current.at < 4000) return;
        lastRef.current = { code: qr.data, at: now };

        busyRef.current = true;
        const result = await scan(qr.data).catch(
          (): ScanFeedback => ({ kind: "error", text: "No pudimos validar. Revisá la conexión." }),
        );
        navigator.vibrate?.(result.kind === "ok" ? 120 : [80, 60, 80]);
        setStatus(result);
        if (result.kind === "ok") router.refresh();
        busyRef.current = false;
      }, 250);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, scan, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-brand-foreground"
      >
        Escanear QR
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
        <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-white/70" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p
        role="status"
        className={`rounded-xl px-4 py-3 text-center font-medium ${
          status.kind === "ok"
            ? "bg-success/10 text-success"
            : status.kind === "warn"
              ? "bg-[var(--gold)]/20 text-foreground"
              : status.kind === "error"
                ? "bg-danger/10 text-danger"
                : "bg-surface text-muted"
        }`}
      >
        {status.text}
      </p>
      <button type="button" onClick={() => setOpen(false)} className="w-full py-2 text-sm text-muted">
        Cerrar cámara
      </button>
    </div>
  );
}
