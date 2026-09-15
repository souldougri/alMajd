import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "./store";
import type { Role } from "./types";
import { ROLE_REDIRECTS } from "./types";
import { BRAND } from "@/lib/brand";
import { canAccessWorkspace, type WorkspaceId } from "@/lib/workspaces";

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const hydrate = useAuth((s) => s.hydrate);
  const navigate = useNavigate();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === "loading") {
      void hydrate();
      return;
    }
    if (status === "guest") {
      const currentPath = router.state.location.pathname;
      void navigate({ to: "/login", search: { redirect: currentPath } as never });
    }
  }, [mounted, status, hydrate, navigate, router]);

  if (!mounted || status !== "authenticated") {
    return <AuthLoading />;
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuth((s) => s.currentUser);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !roles.includes(user.role)) {
      const fallback = user ? ROLE_REDIRECTS[user.role] : "/login";
      void navigate({ to: fallback as never });
    }
  }, [user, roles, navigate]);

  if (!user || !roles.includes(user.role)) {
    return <AuthLoading />;
  }
  return <>{children}</>;
}

export function RequireWorkspace({ workspace, children }: { workspace: WorkspaceId; children: ReactNode }) {
  const user = useAuth((s) => s.currentUser);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !canAccessWorkspace(user.role, user.duties ?? [], workspace)) {
      const fallback = user ? ROLE_REDIRECTS[user.role] : "/login";
      void navigate({ to: fallback as never });
    }
  }, [user, workspace, navigate]);

  if (!user || !canAccessWorkspace(user.role, user.duties ?? [], workspace)) {
    return <AuthLoading />;
  }
  return <>{children}</>;
}

export function AuthLoading() {
  return (
    <div
      className="flex min-h-[60dvh] items-center justify-center"
      style={{ backgroundColor: BRAND.bg, color: BRAND.navy }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="size-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: BRAND.gold, borderTopColor: "transparent" }}
        />
        <p className="text-sm font-medium">جارٍ التحقق من الجلسة…</p>
      </div>
    </div>
  );
}