import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/lib/auth/store";
import { WORKSPACE_LABELS, type WorkspaceId } from "@/lib/workspaces";
import { useSchoolSync } from "@/lib/use-school-sync";

/**
 * First-class web workspace frame: shared AppHeader + a workspace heading.
 * Uses the app-frame class so print overlays hide it during window.print().
 */
export function WorkspaceFrame({ ws, children }: { ws: WorkspaceId; children: ReactNode }) {
  useSchoolSync();
  const user = useAuth((s) => s.currentUser);
  const admin = user?.role === "super_admin";
  const label = WORKSPACE_LABELS[ws];

  return (
    <div className="app-frame flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader
        nav={{
          title: label.ar,
          items: [
            {
              id: "dashboard",
              label: admin ? "لوحة المدير" : "لوحة الموظف",
              icon: LayoutDashboard,
              to: admin ? "/app/admin" : "/app/staff",
            },
          ],
        }}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-4 sm:p-6">
        <PageHeader
          backTo={admin ? "/app/admin" : "/app/staff"}
          backLabel={admin ? "لوحة المدير" : "لوحة الموظف"}
          title={label.ar}
          subtitle={`${label.fr} · ${label.desc}`}
        />
        {children}
      </main>
    </div>
  );
}