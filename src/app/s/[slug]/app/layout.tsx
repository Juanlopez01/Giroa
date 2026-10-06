import { requireStudent } from "@/lib/student-app";
import { StudioHeader } from "@/components/studio/studio-header";
import { StudentNav } from "./student-nav";

// App del alumno: mobile first, con la marca del estudio y menú abajo.
export default async function StudentAppLayout({ children, params }: LayoutProps<"/s/[slug]/app">) {
  const { slug } = await params;
  const { studio } = await requireStudent(slug, "/app");

  return (
    <div className="flex flex-1 flex-col pb-20">
      <StudioHeader studio={studio} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface">
        <div className="mx-auto max-w-md">
          <StudentNav />
        </div>
      </div>
    </div>
  );
}
