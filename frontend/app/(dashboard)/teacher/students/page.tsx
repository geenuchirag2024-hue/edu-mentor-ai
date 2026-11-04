import MainLayout from "@/components/layout/MainLayout";
import TeacherPage from "@/components/teacher/TeacherPage";

export default function TeacherStudentsRoute() {
  return (
    <MainLayout>
      <TeacherPage initialTab="students" />
    </MainLayout>
  );
}

