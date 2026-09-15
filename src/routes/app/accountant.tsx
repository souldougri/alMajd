import { createFileRoute } from "@tanstack/react-router";
import { RequireWorkspace } from "@/lib/auth/guard";
import { AccountantPage } from "@/components/workspaces/accountant";

export const Route = createFileRoute("/app/accountant")({
  component: () => (
    <RequireWorkspace workspace="accountant">
      <AccountantPage />
    </RequireWorkspace>
  ),
});