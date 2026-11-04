import MainLayout from "@/components/layout/MainLayout";
import TeacherPage from "@/components/teacher/TeacherPage";

export default function TeacherNotesRoute() {
  return (
    <MainLayout>
      <TeacherPage initialTab="materials" />
    </MainLayout>
  );
}

