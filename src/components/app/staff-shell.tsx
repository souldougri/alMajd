import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarCheck2, ShieldAlert, Users, Wallet } from "lucide-react";
import { AppHeader } from "./app-header";
import { useAuth } from "@/lib/auth/store";
import { allowedWorkspaces, WORKSPACE_LABELS, type WorkspaceId } from "@/lib/workspaces";

const WS_ICONS: Record<WorkspaceId, typeof Users> = {
  registrar: Users,
  academic: BookOpen,
  accountant: Wallet,
  supervisor: CalendarCheck2,
};

export function StaffShell() {
  const user = useAuth((s) => s.currentUser);
  const ws = user ? allowedWorkspaces(user.role, user.duties) : [];

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-navy">مرحبًا، {user?.nameAr ?? ""}</h1>
          <p className="mt-1 text-sm text-navy/60">
            أنت مسجل الدخول كـ <b>موظف</b> في مجمع المجد التعليمي العربي — اختر مساحة عملك بالأسفل.
          </p>
        </div>

        {ws.length === 0 ? (
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
            {ws.map((id) => {
              const label = WORKSPACE_LABELS[id];
              const Icon = WS_ICONS[id];
              return (
                <Link
                  key={id}
                  to={label.route}
                  className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm transition-colors hover:border-gold"
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