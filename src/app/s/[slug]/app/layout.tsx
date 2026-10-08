import { requireStudent } from "@/lib/student-app";
import { AppHeader } from "@/components/student/app-header";
import { StudentNav } from "./student-nav";

// App del alumno: mobile first, con la marca del estudio, encabezado chico y
// la barra flotante abajo (respeta el área segura del iPhone).
export default async function StudentAppLayout({ children, params }: LayoutProps<"/s/[slug]/app">) {
  const { slug } = await params;
  const { studio } = await requireStudent(slug, "/app");

  return (
    <div className="flex flex-1 flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <AppHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <StudentNav />
        </div>
      </div>
    </div>
  );
}
