// Pantallas de app.giroa.app: login, onboarding y elegir estudio.
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 py-5">
        <span className="text-lg font-semibold tracking-tight">Giroa</span>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-12">{children}</main>
    </div>
  );
}
