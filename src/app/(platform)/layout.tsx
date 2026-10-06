import Link from "next/link";
import { GiroaLogo } from "@/components/brand/giroa-logo";
import { GiroaTheme } from "@/components/brand/giroa-theme";

// Pantallas de app.giroa.app: login, onboarding y elegir estudio.
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <GiroaTheme>
      <header className="px-5 py-5">
        <Link href="/estudios" aria-label="Giroa">
          <GiroaLogo className="text-[26px]" />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-12">{children}</main>
    </GiroaTheme>
  );
}
