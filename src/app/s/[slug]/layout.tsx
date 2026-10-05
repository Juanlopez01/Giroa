import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudioBySlug } from "@/lib/studio.server";

export async function generateMetadata({ params }: LayoutProps<"/s/[slug]">): Promise<Metadata> {
  const studio = await getStudioBySlug((await params).slug);
  return studio ? { title: { default: studio.name, template: `%s · ${studio.name}` } } : {};
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
