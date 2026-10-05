// Sugiere una dirección (subdominio) a partir del nombre del estudio:
// "Estudio Tango Sur" → "estudio-tango-sur". Respeta ^[a-z0-9-]{3,40}$.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
