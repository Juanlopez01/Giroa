// Botón flotante de WhatsApp de la landing: el público de Giroa consulta por
// WhatsApp antes que por formulario. Celular argentino en formato wa.me (54 9 + área + número).
export const GIROA_WHATSAPP = "5493624804761";

export function whatsappHref(text = "¡Hola! Quiero saber más de Giroa para mi estudio.") {
  return `https://wa.me/${GIROA_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export function WhatsAppButton() {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-full bg-[#25d366] py-3 pr-4 pl-3 font-semibold text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
    >
      <svg viewBox="0 0 32 32" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2.1 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3Zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 10 10 5.3 16 5.3s10.9 4.8 10.9 10.6S22 26.4 16 26.4Zm6-7.9c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.4 1.4.6 1.9.7.8.3 1.6.2 2.2.1.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4Z" />
      </svg>
      <span className="hidden sm:inline">Escribinos</span>
    </a>
  );
}
