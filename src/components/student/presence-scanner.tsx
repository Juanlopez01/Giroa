"use client";

import { useRouter } from "next/navigation";
import { QrScanner, type ScanFeedback } from "@/components/panel/qr-scanner";
import { checkinPath, parseCheckinCode } from "@/lib/checkin";

/** Escáner dentro de la app (útil cuando está instalada): lee el cartel y abre el presente. */
export function PresenceScanner() {
  const router = useRouter();
  const scan = async (data: string): Promise<ScanFeedback> => {
    const code = parseCheckinCode(data);
    if (!code) return { kind: "error", text: "Este no es el QR de asistencia del estudio." };
    router.push(checkinPath(code));
    return { kind: "ok", text: "Dando el presente…" };
  };
  return <QrScanner scan={scan} hint="Apuntá al cartel con el QR del estudio." autoOpen />;
}
