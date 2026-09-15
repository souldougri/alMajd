import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, BookOpen, CalendarCheck2, FolderOpen, Globe, HardDriveDownload, LayoutDashboard, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react";
import { AppHeader } from "./app-header";
import { UserManagement } from "./user-management";
import { AuditLogView } from "./audit-log";
import { SiteManager } from "@/components/admin/site-manager";
import { NotificationsComposer } from "@/components/admin/notifications-composer";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { BackupPanel } from "./backup-panel";
import { useAuth } from "@/lib/auth/store";
import { money, todayIso } from "@/lib/school";
import { useSchool } from "@/lib/store";
import { WORKSPACE_LABELS, type WorkspaceId } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

type Tab = "home" | "users" | "audit" | "expenses" | "site" | "notifications" | "documents" | "backup";

const ADMIN_TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "الرئيسية", icon: LayoutDashboard },
  { id: "users", label: "المستخدمون", icon: Users },
  { id: "audit", label: "سجل التدقيق", icon: ShieldCheck },
  { id: "expenses", label: "سجل الإنفاق", icon: Wallet },
  { id: "site", label: "الموقع", icon: Globe },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "documents", label: "المستندات", icon: FolderOpen },
  { id: "backup", label: "نسخة احتياطية", icon: HardDriveDownload },
];

const WS_ICONS: Record<WorkspaceId, typeof Users> = {
  registrar: Users,
  academic: BookOpen,
  accountant: Wallet,
  supervisor: CalendarCheck2,
};

export function AdminShell() {
  const [tab, setTab] = useState<Tab>("home");
  const user = useAuth((s) => s.currentUser);

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-navy">
      <AppHeader
        nav={{
          title: "لوحة المدير",
          items: ADMIN_TABS.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            active: tab === item.id,
            onSelect: () => setTab(item.id),
          })),
        }}
      />
      <div className="flex flex-1">
        <aside className="w-60 shrink-0 border-e border-navy/10 bg-white p-3 max-lg:hidden">
          <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-navy/45">لوحة المدير</p>
          <nav className="flex flex-col gap-0.5">
            {ADMIN_TABS.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm",
                  tab === item.id ? "bg-navy text-gold" : "text-navy/60 hover:bg-cream hover:text-navy",
                )}
              >
                <item.icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {tab === "users" ? (
            <UserManagement />
          ) : tab === "audit" ? (
            <AuditLogView />
          ) : tab === "expenses" ? (
            <ExpensesOverview />
          ) : tab === "site" ? (
            <SiteManager />
          ) : tab === "notifications" ? (
            <NotificationsComposer />
          ) : tab === "documents" ? (
            <AdminDocuments />
          ) : tab === "backup" ? (
            <BackupPanel />
          ) : (
            <AdminDashboard />
          )}
        </main>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const user = useAuth((s) => s.currentUser);
  const students = useSchool((s) => s.students);
  const classes = useSchool((s) => s.classes);
  const subjects = useSchool((s) => s.subjects);
  const terms = useSchool((s) => s.terms);
  const attendance = useSchool((s) => s.attendance);
  const payments = useSchool((s) => s.payments);
  const expenses = useSchool((s) => s.expenses);
  const paidOf = useSchool((s) => s.paidOf);
  const today = todayIso();

  const stats = useMemo(() => {
    const activeClasses = classes.filter((c) => c.active);
    const perClass = activeClasses.map((c) => ({ cls: c, count: students.filter((s) => s.classId === c.id).length })).filter((e) => e.count > 0);
    const due = students.reduce((n, s) => n + s.annualFee, 0);
    const paid = students.reduce((n, s) => n + paidOf(s.id), 0);
    const day = attendance[today] ?? {};
    const entries = Object.values(day);
    const present = entries.filter((v) => v === "present").length;
    const late = entries.filter((v) => v === "late").length;
    const absent = entries.filter((v) => v === "absent").length;
    const expenseTotal = expenses.reduce((n, e) => n + e.amount, 0);
    return {
      perClass,
      due,
      paid,
      outstanding: Math.max(0, due - paid),
      present,
      late,
      absent,
      marked: present + late + absent,
      expenseTotal,
      recentPayments: payments.slice(0, 6),
      recentExpenses: expenses.slice(0, 5),
    };
  }, [students, classes, subjects, terms, attendance, payments, expenses, paidOf, today]);

  const attendanceRate = stats.marked ? Math.round(((stats.present + stats.late) / stats.marked) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">مرحبًا، {user?.nameAr ?? "المدير"}</h1>
        <p className="mt-1 text-sm text-navy/60">ملخص وضع المجمع اليوم — اختر مساحة عمل للدخول إليها بالأعلى أو بالأسفل.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="الطلاب المسجلون" value={String(students.length)} hint={`${stats.perClass.length} صف بخريطة أغلبية`} />
        <StatTile label="حضور اليوم" value={stats.marked ? `${attendanceRate}%` : "—"} hint={`حاضر ${stats.present} · متأخر ${stats.late} · غائب ${stats.absent}`} tone={stats.marked ? (attendanceRate >= 90 ? "ok" : attendanceRate >= 70 ? "warn" : "bad") : undefined} />
        <StatTile label="المحصل من الرسوم" value={money(stats.paid)} hint={`متبقي ${money(stats.outstanding)} من ${money(stats.due)}`} />
        <StatTile label="الإنفاق المسجل" value={money(stats.expenseTotal)} hint={`${stats.recentExpenses.length > 0 ? `${stats.recentExpenses[0].category} — ${money(stats.recentExpenses[0].amount)}` : "لا نفقات بعد"}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-navy">توزع الطلاب حسب الصف</h2>
          <ul className="mt-4 space-y-2">
            {stats.perClass.length === 0 ? (
              <li className="text-sm text-navy/50">لا يوجد طلاب بعد.</li>
            ) : (
              stats.perClass
                .slice()
                .sort((a, b) => a.cls.nameAr.localeCompare(b.cls.nameAr, "ar"))
                .map((e) => (
                  <li key={e.cls.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-navy">{e.cls.nameAr}</span>
                    <span className="rounded-full bg-cream-subtle px-3 py-0.5 text-xs font-bold text-navy">
                      {e.count} طالب
                    </span>
                  </li>
                ))
            )}
          </ul>
          <p className="mt-4 text-xs text-navy/50">
            الفصول النشطة: {classes.filter((c) => c.active).length} · المواد: {subjects.filter((s) => s.active).length} ·
            الفترات: {terms.filter((t) => t.active).length}
          </p>
        </div>

        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-navy">آخر الدفعات</h2>
          <ul className="mt-4 space-y-2">
            {stats.recentPayments.length === 0 ? (
              <li className="text-sm text-navy/50">لا توجد دفعات بعد.</li>
            ) : (
              stats.recentPayments.map((p) => {
                const st = students.find((s) => s.id === p.studentId);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-navy">{st?.nameAr ?? "—"}</p>
                      <p className="text-xs text-navy/50">{p.date} · {p.note}</p>
                    </div>
                    <span className="font-bold text-success">{money(p.amount)}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-bold text-navy">مساحات العمل</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(WORKSPACE_LABELS) as WorkspaceId[]).map((id) => {
            const label = WORKSPACE_LABELS[id];
            const Icon = WS_ICONS[id];
            return (
              <Link
                key={id}
                to={label.route}
                className="rounded-2xl border border-gold/20 bg-white p-5 shadow-sm transition-colors hover:border-gold"
              >
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-navy text-gold">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-bold text-navy">مساحة {label.ar}</h3>
                <p className="mt-1 text-xs text-navy/55">{label.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-navy/55">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-bold",
          tone === "ok" ? "text-success" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-danger" : "text-navy",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-navy/50">{hint}</p>
    </div>
  );
}

function AdminDocuments() {
  const classes = useSchool((s) => s.classes);
  const students = useSchool((s) => s.students);

  return (
    <DocumentsPanel
      canUpload
      allowAnyMode
      showArchived
      classes={classes.filter((c) => c.active).map((c) => ({ id: c.id, nameAr: c.nameAr }))}
      students={students.map((s) => ({ id: s.id, nameAr: s.nameAr }))}
    />
  );
}

function ExpensesOverview() {
  const expenses = useSchool((s) => s.expenses);
  const total = useMemo(() => expenses.reduce((n, e) => n + e.amount, 0), [expenses]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">سجل الإنفاق (قراءة فقط)</h1>
        <p className="mt-1 text-sm text-navy/60">
          إجمالي الإنفاق المسجل: <b className="text-navy">{money(total)}</b>
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-cream-subtle text-navy">
              <th className="px-4 py-3 font-bold">التاريخ</th>
              <th className="px-4 py-3 font-bold">التصنيف</th>
              <th className="px-4 py-3 font-bold">المورّد</th>
              <th className="px-4 py-3 font-bold">البيان</th>
              <th className="px-4 py-3 font-bold">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-navy/50">
                  لا توجد عمليات إنفاق مسجلة بعد.
                </td>
              </tr>
            ) : (
              expenses.map((ex) => (
                <tr key={ex.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-4 py-3">{ex.date}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-cream-subtle px-2.5 py-0.5 text-xs font-semibold text-navy/70">{ex.category}</span>
                  </td>
                  <td className="px-4 py-3 text-navy/70">{ex.vendor || "—"}</td>
                  <td className="px-4 py-3 text-navy/70">{ex.note}</td>
                  <td className="px-4 py-3 font-bold text-navy">{money(ex.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}