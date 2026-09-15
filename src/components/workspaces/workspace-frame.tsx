import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/app/app-header";
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
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-4 sm:p-6">
        <div>
          <Link
            to={admin ? "/app/admin" : "/app/staff"}
            className="text-sm text-navy/55 transition-colors hover:text-gold"
          >
            → {admin ? "لوحة المدير" : "لوحة الموظف"}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold text-navy">{label.ar}</h1>
          <p className="text-sm text-navy/55">
            {label.fr} · {label.desc}
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}