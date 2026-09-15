import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/lib/auth/guard";
import { TeacherShell } from "@/components/app/teacher-shell";

export const Route = createFileRoute("/app/teacher")({
  component: () => (
    <RequireRole roles={["teacher"]}>
      <TeacherShell />
    </RequireRole>
  ),
});