import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/lib/auth/guard";
import { StaffShell } from "@/components/app/staff-shell";

export const Route = createFileRoute("/app/staff")({
  component: () => (
    <RequireRole roles={["staff", "super_admin"]}>
      <StaffShell />
    </RequireRole>
  ),
});