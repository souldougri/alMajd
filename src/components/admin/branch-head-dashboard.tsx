import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  CalendarCheck2,
  ClipboardList,
  GraduationCap,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { DUTY_LABELS, type StaffDuty } from "@/lib/auth/types";
import {
  addBranchDuty,
  getBranchClasses,
  getBranchDuties,
  getBranchFinancialOfficer,
  getBranchMembers,
  getBranchStudents,
  getBranchTeachers,
  getClassAttendance,
  getHeadedBranches,
  removeBranchDuty,
  type AttendanceEntry,
  type Branch,
  type BranchClass,
  type BranchDuty,
  type BranchFinancialOfficer,
  type BranchMember,
  type BranchStudent,
  type BranchTeacher,
} from "@/lib/branches";
import { cn } from "@/lib/utils";

const selectCls =
  "w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30 min-h-11";

type BranchBundle = {
  members: BranchMember[];
  teachers: BranchTeacher[];
  students: BranchStudent[];
  classes: BranchClass[];
  duties: BranchDuty[];
  fo: BranchFinancialOfficer | null;
  attendance: Record<string, AttendanceEntry[]>;
};

const emptyBundle: BranchBundle = {
  members: [],
  teachers: [],
  students: [],
  classes: [],
  duties: [],
  fo: null,
  attendance: {},
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Branch Head workspace ("إدارة الفرع"). Strictly least-privilege:
 * - reads branch-scoped data the head is authorized for (server-enforced),
 * - writes ONLY branch-responsibility delegation/removal,
 * - never offers user creation, member/teacher assignment, head/FO
 *   management, finance, academic-structure or grade writes.
 */
export function BranchHeadDashboard({ userId }: { userId: string }) {
  const [headed, setHeaded] = useState<Branch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<BranchBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [dutyUserId, setDutyUserId] = useState("");
  const [dutyCode, setDutyCode] = useState<StaffDuty>("registrar");
  const [confirmDuty, setConfirmDuty] = useState<BranchDuty | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadHeaded(selectId?: string): Promise<Branch[]> {
    const list = await getHeadedBranches(userId);
    setHeaded(list);
    const target = selectId !== undefined ? selectId : (selectedId ?? list[0]?.id ?? null);
    const stillHeaded = target && list.some((b) => b.id === target) ? target : (list[0]?.id ?? null);
    setSelectedId(stillHeaded);
    return list;
  }

  async function loadDetails(branchId: string) {
    setDetailsLoading(true);
    try {
      const [members, teachers, students, classes, duties, fo] = await Promise.all([
        getBranchMembers(branchId),
        getBranchTeachers(branchId),
        getBranchStudents(branchId),
        getBranchClasses(branchId),
        getBranchDuties(branchId),
        getBranchFinancialOfficer(branchId).catch(() => null),
      ]);
      const date = todayIso();
      const attendancePairs = await Promise.all(
        classes.map(async (c) => {
          const items = await getClassAttendance(c.id, date).catch(() => [] as AttendanceEntry[]);
          return [c.id, items] as const;
        }),
      );
      setBundle({
        members,
        teachers,
        students,
        classes,
        duties,
        fo,
        attendance: Object.fromEntries(attendancePairs),
      });
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refresh(selectId?: string) {
    setLoading(true);
    setError("");
    try {
      const list = await loadHeaded(selectId);
      const target = selectId !== undefined ? selectId : (selectedId ?? list[0]?.id ?? null);
      const active = target && list.some((b) => b.id === target) ? target : (list[0]?.id ?? null);
      if (active) await loadDetails(active);
      else setBundle(emptyBundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات الفرع");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => headed.find((b) => b.id === selectedId) ?? null, [headed, selectedId]);

  async function delegateDuty() {
    if (!selected || busy) return;
    if (!dutyUserId) {
      setError("اختر الموظف المراد تفويضه");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await addBranchDuty(selected.id, dutyUserId, dutyCode);
      setDutyUserId("");
      await loadDetails(selected.id);
      setMessage("تم تفويض المسؤولية بنجاح");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تفويض المسؤولية");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemoveDuty() {
    if (!confirmDuty || !selected || busy) return;
    const target = confirmDuty;
    setConfirmDuty(null);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await removeBranchDuty(selected.id, target.id);
      await loadDetails(selected.id);
      setMessage("تم إلغاء المسؤولية");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إلغاء المسؤولية");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-navy/60">جارٍ تحميل إدارة الفرع…</p>;
  }

  if (headed.length === 0 || !selected) {
    return (
      <section className="rounded-2xl border border-dashed border-navy/20 bg-white p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-navy">
          <Building2 className="size-7" />
        </div>
        <h2 className="mt-4 font-display text-lg font-bold text-navy">لست ناظرًا على أي فرع حاليًا</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy/60">
          عندما يعيّنك المدير العام ناظرًا على فرع ستظهر لك هنا «إدارة الفرع» الخاصة به تلقائيًا،
          وإذا أُلغي تعيينك ستختفي من هنا تلقائيًا.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </section>
    );
  }

  const attendanceToday = todayIso();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">إدارة الفرع</h1>
        <p className="mt-1 text-sm text-navy/60">
          {headed.length > 1 ? "أنت ناظر على عدة فروع — اختر الفرع لعرض بياناته." : "البيانات المعروضة خاصة بفرعك فقط."}
        </p>
      </div>

      {headed.length > 1 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {headed.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setSelectedId(b.id);
                setMessage("");
                setError("");
                void loadDetails(b.id);
              }}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-start shadow-sm",
                selectedId === b.id ? "border-gold" : "border-navy/10",
              )}
            >
              <Building2 className="size-4 shrink-0 text-gold" />
              <span className="truncate text-sm font-bold text-navy">{b.nameAr}</span>
              {selectedId === b.id ? <Badge tone="brand">المحدد</Badge> : null}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">{message}</p> : null}

      <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-navy">
          <Building2 className="size-5 text-gold" />
          {selected.nameAr}
        </h2>
        <p className="mt-1 text-xs text-navy/55">
          {[selected.address, selected.phone].filter(Boolean).join(" · ") || "بدون تفاصيل إضافية"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge tone="brand">أنت ناظر هذا الفرع</Badge>
          {bundle.fo ? (
            <Badge tone="muted">المسؤول المالي: {bundle.fo.userNameAr} (يتبع المدير العام)</Badge>
          ) : (
            <Badge tone="muted">بدون مسؤول مالي معيَّن</Badge>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CountTile label="الموظفون" value={bundle.members.length} />
          <CountTile label="المعلمون" value={bundle.teachers.length} />
          <CountTile label="الطلاب" value={bundle.students.length} />
          <CountTile label="الفصول" value={bundle.classes.length} />
        </div>
      </section>

      {detailsLoading ? (
        <p className="py-6 text-center text-sm text-navy/60">جارٍ تحميل تفاصيل الفرع…</p>
      ) : (
        <>
          <ReadList
            icon={Users}
            title={`موظفو الفرع (${bundle.members.length})`}
            empty="لا يوجد موظفون ملحقون بهذا الفرع بعد."
            items={bundle.members.map((m) => ({ id: m.id, name: m.userNameAr ?? m.userId }))}
          />
          <ReadList
            icon={GraduationCap}
            title={`معلمو الفرع (${bundle.teachers.length})`}
            empty="لا يوجد معلمون ملحقون بهذا الفرع بعد."
            items={bundle.teachers.map((t) => ({ id: t.id, name: t.userNameAr ?? t.teacherUserId }))}
          />
          <ReadList
            icon={BookOpen}
            title={`طلاب الفرع (${bundle.students.length})`}
            empty="لا يوجد طلاب مسجلون في هذا الفرع بعد."
            items={bundle.students.map((s) => ({ id: s.id, name: s.nameAr, hint: s.klass || undefined }))}
          />
          <ReadList
            icon={BookOpen}
            title={`الفصول (${bundle.classes.length})`}
            empty="لا توجد فصول في هذا الفرع بعد."
            items={bundle.classes.map((c) => ({
              id: c.id,
              name: c.nameAr,
              hint: c.headTeacherNameAr ? `المعلم المسؤول: ${c.headTeacherNameAr}` : undefined,
            }))}
          />

          <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-navy">
              <CalendarCheck2 className="size-4 text-gold" />
              حضور اليوم ({attendanceToday})
            </h3>
            {bundle.classes.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
                لا توجد فصول لعرض حضورها.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {bundle.classes.map((c) => {
                  const marks = bundle.attendance[c.id] ?? [];
                  const present = marks.filter((m) => m.status === "present").length;
                  const late = marks.filter((m) => m.status === "late").length;
                  const absent = marks.filter((m) => m.status === "absent").length;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-navy/10 px-3 py-2.5 text-sm">
                      <span className="font-bold text-navy">{c.nameAr}</span>
                      <span className="text-xs text-navy/60">
                        {marks.length === 0
                          ? "لم يُرصد حضور اليوم"
                          : `حاضر ${present} · متأخر ${late} · غائب ${absent}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-navy">
              <ClipboardList className="size-4 text-gold" />
              المسؤوليات المفوَّضة ({bundle.duties.length})
            </h3>
            <p className="mt-1 text-xs text-navy/55">
              يمكنك تفويض المهام التشغيلية لموظفي فرعك وإلغاءها — دون منح أي صلاحيات نظام إضافية.
            </p>
            {bundle.duties.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
                لا توجد مسؤوليات مفوَّضة في فرعك بعد.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {bundle.duties.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-navy/10 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy">{d.userNameAr ?? d.userId}</p>
                      <p className="truncate text-xs text-navy/55">{DUTY_LABELS[d.dutyCode as StaffDuty]?.ar ?? d.dutyCode}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDuty(d)}
                      aria-label={`إلغاء مسؤولية ${d.userNameAr ?? d.userId}`}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 rounded-xl bg-cream-subtle p-3">
              <p className="mb-2 text-sm font-bold text-navy">تفويض مسؤولية</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="الموظف"
                  className={selectCls}
                  value={dutyUserId}
                  onChange={(e) => setDutyUserId(e.target.value)}
                >
                  <option value="">اختر موظفًا من فرعك…</option>
                  {bundle.members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.userNameAr ?? m.userId}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="المهمة"
                  className={selectCls}
                  value={dutyCode}
                  onChange={(e) => setDutyCode(e.target.value as StaffDuty)}
                >
                  {(Object.keys(DUTY_LABELS) as StaffDuty[]).map((d) => (
                    <option key={d} value={d}>
                      {DUTY_LABELS[d].ar}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={delegateDuty}
                disabled={busy || !dutyUserId}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
              >
                <Plus className="size-4" />
                تفويض
              </button>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmDuty)}
        title="تأكيد إلغاء المسؤولية"
        description={
          confirmDuty
            ? `هل أنت متأكد من إلغاء مسؤولية «${DUTY_LABELS[confirmDuty.dutyCode as StaffDuty]?.ar ?? confirmDuty.dutyCode}» عن «${confirmDuty.userNameAr ?? confirmDuty.userId}»؟`
            : undefined
        }
        confirmLabel="نعم، إلغاء"
        cancelLabel="تراجع"
        onConfirm={() => void confirmRemoveDuty()}
        onCancel={() => setConfirmDuty(null)}
      />
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-cream-subtle px-3 py-2.5 text-center">
      <p className="font-display text-xl font-bold text-navy">{value}</p>
      <p className="text-xs text-navy/55">{label}</p>
    </div>
  );
}

function ReadList(props: {
  icon: typeof Users;
  title: string;
  empty: string;
  items: Array<{ id: string; name: string; hint?: string }>;
}) {
  const { icon: Icon, title, empty, items } = props;
  return (
    <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <Icon className="size-4 text-gold" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          {empty}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-navy/10 px-3 py-2.5">
              <p className="truncate text-sm font-bold text-navy">{item.name}</p>
              {item.hint ? <p className="truncate text-xs text-navy/55">{item.hint}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
