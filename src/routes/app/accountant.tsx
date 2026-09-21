import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RequireWorkspace } from "@/lib/auth/guard";
import { useAuth } from "@/lib/auth/store";
import { canAccessWorkspace } from "@/lib/workspaces";
import { getFinancialOfficerBranches } from "@/lib/branches";
import { AccountantPage } from "@/components/workspaces/accountant";

export const Route = createFileRoute("/app/accountant")({
  component: () => (
    <AccountantGate>
      <AccountantPage />
    </AccountantGate>
  ),
});

/**
 * Admits super_admin / accountant-duty staff through the existing workspace
 * guard, plus staff who are currently Financial Officers of at least one
 * branch. The workspace UI itself is untouched: branch data isolation comes
 * from the existing server-side scope (store hydration fetches as the user,
 * and every finance read/write is branch-scope-checked).
 */
function AccountantGate({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.currentUser);
  const [foBranches, setFoBranches] = useState<string[] | null>(null);

  const dutyOk = user ? canAccessWorkspace(user.role, user.duties ?? [], "accountant") : false;

  useEffect(() => {
    if (!user || dutyOk || user.role !== "staff") {
      setFoBranches(null);
      return;
    }
    let cancelled = false;
    getFinancialOfficerBranches(user.id)
      .then((list) => {
        if (!cancelled) setFoBranches(list.map((b) => b.id));
      })
      .catch(() => {
        if (!cancelled) setFoBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, dutyOk]);

  if (!user) return null;
  if (dutyOk) return <>{children}</>;
  // Non-staff roles keep the exact previous behavior (bounce via the guard).
  if (user.role !== "staff") {
    return (
      <RequireWorkspace workspace="accountant">
        {children}
      </RequireWorkspace>
    );
  }
  if (foBranches === null) {
    return <p className="py-10 text-center text-sm text-navy/60">جارٍ التحقق…</p>;
  }
  if (foBranches.length > 0) return <>{children}</>;
  return (
    <RequireWorkspace workspace="accountant">
      {children}
    </RequireWorkspace>
  );
}
