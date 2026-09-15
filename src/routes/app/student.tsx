import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/lib/auth/guard";
import { StudentShell } from "@/components/app/student-shell";

export const Route = createFileRoute("/app/student")({
  component: () => (
    <RequireRole roles={["student"]}>
      <StudentShell />
    </RequireRole>
  ),
});