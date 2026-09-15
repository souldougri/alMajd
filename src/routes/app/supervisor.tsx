import { createFileRoute } from "@tanstack/react-router";
import { RequireWorkspace } from "@/lib/auth/guard";
import { SupervisorPage } from "@/components/workspaces/supervisor";

export const Route = createFileRoute("/app/supervisor")({
  component: () => (
    <RequireWorkspace workspace="supervisor">
      <SupervisorPage />
    </RequireWorkspace>
  ),
});