import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/lib/auth/guard";
import { ParentShell } from "@/components/app/parent-shell";

export const Route = createFileRoute("/app/parent")({
  component: () => (
    <RequireRole roles={["parent"]}>
      <ParentShell />
    </RequireRole>
  ),
});
