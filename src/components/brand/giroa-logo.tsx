/**
 * Wordmark de Giroa: "giroa" en minúscula (Fraunces); la "o" es un anillo con
 * un arco dorado que sugiere el giro. Hecho con texto + CSS para que se alinee
 * solo con la tipografía en cualquier tamaño.
 *
 * Las letras visibles salen de CSS (content: attr(data-l)), así el único texto
 * real es "Giroa": Google, los lectores de pantalla y quien copia el texto leen
 * "Giroa" y no "gir a".
 */
export function GiroaLogo({ className = "text-[28px]" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-serif leading-none font-semibold tracking-tight text-brand ${className}`}>
      <span className="sr-only">Giroa</span>
      <span aria-hidden="true" data-l="gir" className="before:content-[attr(data-l)]" />
      <span aria-hidden="true" className="relative mx-[0.03em] inline-block h-[0.5em] w-[0.5em] self-center">
        <span className="absolute inset-0 rounded-full border-[0.085em] border-current" />
        <span
          className="absolute -inset-[0.16em] rounded-full border-[0.07em] border-transparent"
          style={{ borderTopColor: "var(--gold, #c8a46b)", transform: "rotate(-25deg)" }}
        />
      </span>
      <span aria-hidden="true" data-l="a" className="before:content-[attr(data-l)]" />
    </span>
  );
}
