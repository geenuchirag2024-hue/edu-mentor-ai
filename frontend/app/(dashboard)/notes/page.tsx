import { Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import NotesPage from "@/components/notes/NotesPage";

export default function NotesRoute() {
  return (
    <MainLayout>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500">
            Loading notes workspace...
          </div>
        }
      >
        <NotesPage />
      </Suspense>
    </MainLayout>
  );
}
