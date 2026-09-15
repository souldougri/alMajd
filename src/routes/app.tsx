import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/lib/auth/guard";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}