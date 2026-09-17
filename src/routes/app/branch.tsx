import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { RequireRole } from "@/lib/auth/guard";
import { AppHeader } from "@/components/app/app-header";
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

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader nav={{ title: "إدارة الفرع", items: [] }} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
        {!checked || !user ? (
          <p className="py-10 text-center text-sm text-navy/60">جارٍ التحقق…</p>
        ) : !isHead && user.role !== "super_admin" ? (
          <section className="rounded-2xl border border-dashed border-navy/20 bg-white p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-navy">
              <Building2 className="size-7" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-navy">هذه المساحة مخصصة لنُظّار الفروع</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy/60">
              لست معيّنًا ناظرًا على أي فرع حاليًا. عندما يعيّنك المدير العام ستظهر لك إدارة فرعك هنا تلقائيًا.
            </p>
          </section>
        ) : (
          <BranchHeadDashboard userId={user.id} />
        )}
      </main>
    </div>
  );
}
