import { createFileRoute } from "@tanstack/react-router";
import { RequireWorkspace } from "@/lib/auth/guard";
import { AcademicPage } from "@/components/workspaces/academic";

export const Route = createFileRoute("/app/academic")({
  component: () => (
    <RequireWorkspace workspace="academic">
      <AcademicPage />
    </RequireWorkspace>
  ),
});