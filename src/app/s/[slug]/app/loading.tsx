// Mientras carga una pantalla de la app: siluetas en lugar de pantalla en blanco.
export default function StudentAppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded-full bg-border" />
        <div className="h-7 w-40 animate-pulse rounded-full bg-border" />
      </div>
      <div className="h-40 animate-pulse rounded-3xl bg-brand/15" />
      <div className="h-20 animate-pulse rounded-2xl bg-border/70" />
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-border" />
        <div className="h-24 animate-pulse rounded-2xl bg-border/70" />
        <div className="h-24 animate-pulse rounded-2xl bg-border/70" />
      </div>
    </div>
  );
}
