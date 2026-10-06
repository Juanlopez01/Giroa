import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getStudioBySlug } from "@/lib/studio.server";

export async function generateMetadata({ params }: LayoutProps<"/s/[slug]">): Promise<Metadata> {
  const studio = await getStudioBySlug((await params).slug);
  if (!studio) return {};
  return {
    title: { default: studio.name, template: `%s · ${studio.name}` },
    description: `Reservá tus clases en ${studio.name}.`,
    // PWA: se instala como "la app del estudio" (manifest e íconos según el host).
    manifest: "/api/pwa/manifest",
    icons: {
      icon: [{ url: "/api/pwa/icon?size=192", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/api/pwa/icon?size=180", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: studio.name, statusBarStyle: "default" },
  };
}

export async function generateViewport({ params }: LayoutProps<"/s/[slug]">): Promise<Viewport> {
  const studio = await getStudioBySlug((await params).slug);
  return { themeColor: studio?.brand_color ?? "#6b1f2e" };
}

// Todo lo que está bajo el subdominio de un estudio usa su color de marca.
export default async function StudioLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  const studio = await getStudioBySlug((await params).slug);
  if (!studio) notFound();

  return (
    <div className="flex flex-1 flex-col" style={{ "--brand": studio.brand_color } as React.CSSProperties}>
      {children}
    </div>
  );
}
