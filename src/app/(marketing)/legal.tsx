// Datos del responsable de Giroa, compartidos por Términos y Privacidad.
export const LEGAL = {
  owner: "Juan Pablo López",
  email: "hola@giroa.com.ar",
  updated: "8 de octubre de 2026",
} as const;

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
      <h1 className="font-serif text-4xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: {LEGAL.updated}</p>
      <div className="mt-8 space-y-6 leading-relaxed [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5 [&_a]:text-brand [&_a]:underline">
        {children}
      </div>
    </main>
  );
}
