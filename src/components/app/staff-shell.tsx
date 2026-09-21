import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Building2, CalendarCheck2, ShieldAlert, Users, Wallet } from "lucide-react";
import { AppHeader } from "./app-header";
import { useAuth } from "@/lib/auth/store";
import { allowedWorkspaces, WORKSPACE_LABELS, type WorkspaceId } from "@/lib/workspaces";
import { getFinancialOfficerBranches, getHeadedBranches } from "@/lib/branches";

const WS_ICONS: Record<WorkspaceId, typeof Users> = {
  registrar: Users,
  academic: BookOpen,
  accountant: Wallet,
  supervisor: CalendarCheck2,
};

export function StaffShell() {
  const user = useAuth((s) => s.currentUser);
  const ws = user ? allowedWorkspaces(user.role, user.duties) : [];
  // Organizational role (not a duty): active Branch Head assignments unlock
  // the "إدارة الفرع" workspace even with zero duties. Disappears when the
  // assignment is removed.
  const [headBranchCount, setHeadBranchCount] = useState(0);
  const [foBranchCount, setFoBranchCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!user || user.role !== "staff") return;
    getHeadedBranches(user.id)
      .then((list) => {
        if (!cancelled) setHeadBranchCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setHeadBranchCount(0);
      });
    // Same organizational-role pattern for Financial Officers: entry to the
    // existing Accounting Workspace for their assigned branches only.
    getFinancialOfficerBranches(user.id)
      .then((list) => {
        if (!cancelled) setFoBranchCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setFoBranchCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader
        nav={{
          title: "لوحة الموظف",
          items: ws.map((id) => {
            const label = WORKSPACE_LABELS[id];
            const Icon = WS_ICONS[id];
            return {
              id,
              label: `مساحة ${label.ar}`,
              icon: Icon,
              to: label.route,
            };
          }),
        }}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-navy">مرحبًا، {user?.nameAr ?? ""}</h1>
          <p className="mt-1 text-sm text-navy/60">
            أنت مسجل الدخول كـ <b>موظف</b> في مجمع المجد التعليمي العربي — اختر مساحة عملك بالأسفل.
          </p>
        </div>

        {headBranchCount > 0 ? (
          <Link
            to="/app/branch"
            className="am-card am-card-hover mb-4 flex items-center gap-4 p-6"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-gold">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-navy">إدارة الفرع</h2>
              <p className="mt-1 text-sm text-navy/60">
                أنت ناظر على {headBranchCount === 1 ? "فرع واحد" : `${headBranchCount} فروع`} — اعرض بيانات فرعك وفوّض
                المسؤوليات التشغيلية.
              </p>
            </div>
          </Link>
        ) : null}
        {foBranchCount > 0 ? (
          <Link
            to="/app/accountant"
            className="am-card am-card-hover mb-4 flex items-center gap-4 p-6"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-gold">
              <Wallet className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-navy">مساحة المحاسبة</h2>
              <p className="mt-1 text-sm text-navy/60">
                أنت المسؤول المالي على {foBranchCount === 1 ? "فرع واحد" : `${foBranchCount} فروع`} — اعرض
                البيانات المالية لفروعك.
              </p>
            </div>
          </Link>
        ) : null}
        {ws.length === 0 && headBranchCount === 0 && foBranchCount === 0 ? (
          <div className="rounded-2xl border border-gold/30 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-gold/15">
              <ShieldAlert className="size-6 text-navy" />
            </div>
            <h2 className="font-bold text-navy">لم تُحدد صلاحياتك بعد</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-navy/60">
              لم تُخوَّل لمنطقة عمل محددة بعد. تواصل مع إدارة المدرسة لتحديد اختصاصك (تسجيل، شؤون دراسية،
              محاسبة، إشراف) وسيظهر لك مساح عملتك هنا مباشرةً.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ws.map((id, i) => {
              const label = WORKSPACE_LABELS[id];
              const Icon = WS_ICONS[id];
              return (
                <Link
                  key={id}
                  to={label.route}
                  style={{ "--rise-delay": `${i * 60}ms` } as CSSProperties}
                  className="am-card am-card-hover rise-in p-6"
                >
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-navy text-gold">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="font-bold text-navy">مساحة {label.ar}</h2>
                  <p className="mt-1 text-sm text-navy/60">{label.desc}</p>
                  <span className="mt-4 inline-block rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-navy">
                    {label.fr}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}