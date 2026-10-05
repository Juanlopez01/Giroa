import { platformUrl } from "@/lib/urls";

// Provisorio: la landing de Giroa llega en el paso 16, con la identidad visual.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5">
      <h1 className="text-4xl font-semibold tracking-tight">Giroa</h1>
      <p className="text-lg text-muted">
        Dejá de perseguir a los alumnos para que paguen y de anotar clases en un cuaderno.
      </p>
      <a
        href={platformUrl("/login")}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-5 font-medium text-brand-foreground"
      >
        Entrar
      </a>
    </main>
  );
}
