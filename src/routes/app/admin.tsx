import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/lib/auth/guard";
import { AdminShell } from "@/components/app/admin-shell";

export const Route = createFileRoute("/app/admin")({
  component: () => (
    <RequireRole roles={["super_admin"]}>
      <AdminShell />
    </RequireRole>
  ),
});