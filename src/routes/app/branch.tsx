import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, LayoutDashboard } from "lucide-react";
import { RequireRole } from "@/lib/auth/guard";
import { AppHeader } from "@/components/app/app-header";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { BranchHeadDashboard } from "@/components/admin/branch-head-dashboard";
import { useAuth } from "@/lib/auth/store";
import { getHeadedBranches } from "@/lib/branches";

export const Route = createFileRoute("/app/branch")({
  component: () => (
    <RequireRole roles={["staff", "super_admin"]}>
      <BranchPage />
    </RequireRole>
  ),
});

function BranchPage() {
  const user = useAuth((s) => s.currentUser);
  const [checked, setChecked] = useState(false);
  const [isHead, setIsHead] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setChecked(true);
        return;
      }
      try {
        const headed = await getHeadedBranches(user.id);
        if (!cancelled) setIsHead(headed.length > 0);
      } catch {
        if (!cancelled) setIsHead(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const admin = user?.role === "super_admin";
  const dashboardTo = admin ? "/app/admin" : "/app/staff";
  const dashboardLabel = admin ? "لوحة المدير" : "لوحة الموظف";

  return (
    <div className="app-frame flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader
        nav={{
          title: "إدارة الفرع",
          items: [
            {
              id: "dashboard",
              label: dashboardLabel,
              icon: LayoutDashboard,
              to: dashboardTo,
            },
          ],
        }}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-4 sm:p-6">
        <PageHeader
          backTo={dashboardTo}
          backLabel={dashboardLabel}
          title="إدارة الفرع"
          subtitle="Gestion de branche · بيانات فرعك وصلاحيات الناظر"
        />
        {!checked || !user ? (
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="جارٍ التحقق">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !isHead && user.role !== "super_admin" ? (
          <EmptyState
            icon={Building2}
            title="هذه المساحة مخصصة لنُظّار الفروع"
            body="لست معيّنًا ناظرًا على أي فرع حاليًا. عندما يعيّنك المدير العام ستظهر لك إدارة فرعك هنا تلقائيًا."
          />
        ) : (
          <BranchHeadDashboard userId={user.id} />
        )}
      </main>
    </div>
  );
}
