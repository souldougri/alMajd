import { createFileRoute } from "@tanstack/react-router";
import { RequireWorkspace } from "@/lib/auth/guard";
import { RegistrarPage } from "@/components/workspaces/registrar";

export const Route = createFileRoute("/app/registrar")({
  component: () => (
    <RequireWorkspace workspace="registrar">
      <RegistrarPage />
    </RequireWorkspace>
  ),
});