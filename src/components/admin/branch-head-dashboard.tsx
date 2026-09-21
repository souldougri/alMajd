import { Fragment, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck2,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  ShieldAlert,
  Timer,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { ConfirmDialog, Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { StudentsView } from "@/components/desk/students";
import { PrintProvider } from "@/components/desk/print";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BranchReports } from "@/components/reports/branch-reports";
import { Badge } from "@/components/ui/badge";
import { DUTY_LABELS, type StaffDuty } from "@/lib/auth/types";
import {
  addBranchDuty,
  addBranchWarning,
  addTeachingAssignment,
  attachClassSubject,
  createBranchClass,
  createBranchExamSession,
  detachClassSubject,
  getAcademicYears,
  getBranchClasses,
  getBranchDuties,
  getBranchExamSessions,
  getBranchFinancialOfficer,
  getBranchMembers,
  getBranchStudents,
  getBranchTeachers,
  getBranchWarnings,
  getClassAttendance,
  getClassPublishedResults,
  getClassSubjects,
  getClassTimetable,
  getHeadedBranches,
  getSubjectsCatalog,
  getTeacherAssignments,
  getTerms,
  markBranchAttendance,
  removeBranchAttendance,
  removeBranchDuty,
  removeBranchWarning,
  removeTeachingAssignment,
  removeTimetableSlot,
  setClassPublishedResult,
  updateBranchClass,
  upsertTimetableSlot,
  type AcademicYear,
  type AttendanceEntry,
  type Branch,
  type BranchClass,
  type BranchDuty,
  type BranchFinancialOfficer,
  type BranchMember,
  type BranchStudent,
  type BranchTeacher,
  type BranchWarning,
  type CatalogSubject,
  type ClassSubject,
  type ExamSession,
  type PublishedResult,
  type TeachingAssignment,
  type Term,
  type TimetableSlot,
} from "@/lib/branches";
import { cn } from "@/lib/utils";

const inputCls = "am-input";
const labelCls = "am-label";

const selectCls = "am-input";

type BranchSectionId =
  | "members"
  | "teachers"
  | "students"
  | "classes"
  | "attendance"
  | "exams"
  | "results"
  | "reports"
  | "warnings"
  | "duties";

const BRANCH_SECTIONS: {
  id: BranchSectionId;
  title: string;
  desc: string;
  icon: typeof Users;
}[] = [
  { id: "members", title: "موظفو الفرع", desc: "عرض الموظفين الملحقين بفرعك.", icon: Users },
  { id: "teachers", title: "المعلمون", desc: "تعيينات المعلمين وموادهم.", icon: GraduationCap },
  { id: "students", title: "الطلاب", desc: "تسجيل وإدارة طلاب الفرع.", icon: BookOpen },
  { id: "classes", title: "الفصول والمواد والجدول", desc: "إنشاء الفصول وربط المواد والجدول الزمني.", icon: Building2 },
  { id: "attendance", title: "الحضور", desc: "رصد حضور اليوم وتحضير الفصول.", icon: CalendarCheck2 },
  { id: "exams", title: "الاختبارات", desc: "جلسات الاختبارات وموادها.", icon: FileText },
  { id: "results", title: "النتائج", desc: "نشر نتائج الفصول.", icon: Award },
  { id: "reports", title: "التقارير", desc: "تقارير الفرع الجاهزة.", icon: BarChart3 },
  { id: "warnings", title: "الإنذارات", desc: "إنذارات الطلاب ومتابعتها.", icon: ShieldAlert },
  { id: "duties", title: "التفويض", desc: "تفويض المسؤوليات التشغيلية لموظفي فرعك.", icon: ClipboardList },
];

/**
 * Responsibilities a Branch Head may delegate. Financial duties are excluded:
 * the Financial Officer reports directly to the General Manager through the
 * dedicated Financial Officer architecture — never through branch delegation.
 */
const BRANCH_HEAD_DELEGATABLE_DUTIES = (Object.keys(DUTY_LABELS) as StaffDuty[]).filter(
  (d) => d !== "accountant",
);

type BranchBundle = {
  members: BranchMember[];
  teachers: BranchTeacher[];
  students: BranchStudent[];
  classes: BranchClass[];
  duties: BranchDuty[];
  warnings: BranchWarning[];
  fo: BranchFinancialOfficer | null;
  attendance: Record<string, AttendanceEntry[]>;
};

const emptyBundle: BranchBundle = {
  members: [],
  teachers: [],
  students: [],
  classes: [],
  duties: [],
  warnings: [],
  fo: null,
  attendance: {},
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Same pill tab used by the GM workspaces (e.g. الشؤون الدراسية). */
function BranchTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors",
        active ? "bg-navy text-gold" : "bg-cream-subtle text-navy/60 hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}

/**
 * One branch workspace = one card grouping all of its panels behind pill
 * tabs — the exact layout grammar of the existing GM workspaces.
 */
function BranchWorkspace({ tabs }: { tabs: { id: string; label: string; icon?: ReactNode; node: ReactNode }[] }) {
  const [tab, setTab] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <section className="am-card p-4 shadow-sm sm:p-6">
      {tabs.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <BranchTabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.icon}
              {t.label}
            </BranchTabButton>
          ))}
        </div>
      ) : null}
      {current?.node}
    </section>
  );
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
  const [section, setSection] = useState<BranchSectionId | null>(null);

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
      const [members, teachers, students, classes, duties, warnings, fo] = await Promise.all([
        getBranchMembers(branchId),
        getBranchTeachers(branchId),
        getBranchStudents(branchId),
        getBranchClasses(branchId),
        getBranchDuties(branchId),
        getBranchWarnings(branchId).catch(() => [] as BranchWarning[]),
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
        warnings,
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
    return (
      <div className="space-y-4" aria-busy="true" aria-label="جارٍ تحميل إدارة الفرع">
        <SkeletonCard />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (headed.length === 0 || !selected) {
    return (
      <EmptyState
        icon={Building2}
        title="لست ناظرًا على أي فرع حاليًا"
        body="عندما يعيّنك المدير العام ناظرًا على فرع ستظهر لك هنا «إدارة الفرع» الخاصة به تلقائيًا، وإذا أُلغي تعيينك ستختفي من هنا تلقائيًا."
      >
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </EmptyState>
    );
  }

  const attendanceToday = todayIso();

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy/60">
        {headed.length > 1 ? "أنت ناظر على عدة فروع — اختر الفرع لعرض بياناته." : "البيانات المعروضة خاصة بفرعك فقط."}
      </p>

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
                setSection(null);
                // Drop branch-scoped form state: a stale selection could
                // otherwise delegate to a user from the previous branch.
                setDutyUserId("");
                setConfirmDuty(null);
                void loadDetails(b.id);
              }}
              className={cn(
                "am-card am-card-hover flex min-h-11 items-center gap-2 px-4 py-3 text-start",
                selectedId === b.id && "border-gold",
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

      <section className="am-card rise-in p-5">
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
            <Badge tone="muted">المسؤول المالي: {bundle.fo.userNameAr}</Badge>
          ) : (
            <Badge tone="muted">بدون مسؤول مالي معيَّن</Badge>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CountTile icon={Users} label="الموظفون" value={bundle.members.length} />
          <CountTile icon={GraduationCap} label="المعلمون" value={bundle.teachers.length} />
          <CountTile icon={BookOpen} label="الطلاب" value={bundle.students.length} />
          <CountTile icon={Building2} label="الفصول" value={bundle.classes.length} />
        </div>
      </section>

      {detailsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="جارٍ تحميل تفاصيل الفرع">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        // Keyed by branch: remounts every section so picker/draft state from
        // the previous branch can never leak into the newly selected branch.
        <Fragment key={selected.id}>
          {section === null ? (
            <div>
              <h2 className="mb-3 font-bold text-navy">مساحات العمل</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {BRANCH_SECTIONS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    style={{ "--rise-delay": `${i * 50}ms` } as CSSProperties}
                    className="am-card am-card-hover rise-in p-5 text-start"
                  >
                    <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-navy text-gold">
                      <s.icon className="size-5" />
                    </div>
                    <h3 className="font-bold text-navy">{s.title}</h3>
                    <p className="mt-1 text-xs text-navy/55">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            (() => {
              const active = BRANCH_SECTIONS.find((s) => s.id === section);
              return (
                <div className="mb-1">
                  <button
                    type="button"
                    onClick={() => setSection(null)}
                    className="text-sm text-navy/55 transition-colors hover:text-gold"
                  >
                    → إدارة الفرع
                  </button>
                  <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-navy sm:text-3xl">
                    {active ? <active.icon className="size-6 text-gold" /> : null}
                    {active?.title}
                  </h2>
                  <p className="text-sm text-navy/55">{active?.desc}</p>
                </div>
              );
            })()
          )}
          {section === "members" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "list",
                  label: "الموظفون",
                  icon: <Users className="size-4" />,
                  node: (
                    <ReadList
                      icon={Users}
                      title={`موظفو الفرع (${bundle.members.length})`}
                      empty="لا يوجد موظفون ملحقون بهذا الفرع بعد."
                      items={bundle.members.map((m) => ({ id: m.id, name: m.userNameAr ?? m.userId }))}
                    />
                  ),
                },
              ]}
            />
          ) : null}
          {section === "teachers" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "list",
                  label: "المعلمون",
                  icon: <GraduationCap className="size-4" />,
                  node: (
                    <TeachersSection
                      teachers={bundle.teachers}
                      classes={bundle.classes}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
              ]}
            />
          ) : null}
          {section === "students" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "list",
                  label: "الطلاب",
                  icon: <BookOpen className="size-4" />,
                  // Same workspace component as the GM/registrar student
                  // workspace, locked to the current branch (branch scope).
                  node: (
                    <PrintProvider>
                      <StudentsView
                        mode="branch"
                        branchId={selected.id}
                        onRegistered={() => {
                          setMessage("تم تسجيل الطالب بنجاح");
                          void loadDetails(selected.id);
                        }}
                      />
                    </PrintProvider>
                  ),
                },
              ]}
            />
          ) : null}
          {section === "classes" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "classes",
                  label: "الفصول",
                  icon: <Layers className="size-4" />,
                  node: (
                    <ClassesSection
                      branchId={selected.id}
                      classes={bundle.classes}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
                {
                  id: "subjects",
                  label: "المواد",
                  icon: <BookOpen className="size-4" />,
                  node: (
                    <ClassSubjectsSection
                      classes={bundle.classes}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
                {
                  id: "timetable",
                  label: "الجدول الزمني",
                  icon: <Timer className="size-4" />,
                  node: (
                    <TimetableSection
                      classes={bundle.classes}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
              ]}
            />
          ) : null}
          {section === "exams" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "sessions",
                  label: "الاختبارات",
                  icon: <FileText className="size-4" />,
                  node: (
                    <ExamsSection
                      branchId={selected.id}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
              ]}
            />
          ) : null}
          {section === "results" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "publish",
                  label: "النتائج",
                  icon: <Award className="size-4" />,
                  node: (
                    <ResultsSection
                      classes={bundle.classes}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
              ]}
            />
          ) : null}
          {section === "reports" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "reports",
                  label: "التقارير",
                  icon: <BarChart3 className="size-4" />,
                  node: <BranchReports branchId={selected.id} />,
                },
              ]}
            />
          ) : null}

          {section === "attendance" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "today",
                  label: "حضور اليوم",
                  icon: <CalendarCheck2 className="size-4" />,
                  node: (
                    <section>
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
                  ),
                },
                {
                  id: "manage",
                  label: "تحضير الحضور",
                  icon: <ClipboardList className="size-4" />,
                  node: (
                    <AttendanceManage
                      classes={bundle.classes}
                      students={bundle.students}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
              ]}
            />
          ) : null}

          {section === "warnings" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "list",
                  label: "الإنذارات",
                  icon: <ShieldAlert className="size-4" />,
                  node: (
                    <WarningsSection
                      branchId={selected.id}
                      students={bundle.students}
                      warnings={bundle.warnings}
                      onChanged={() => loadDetails(selected.id)}
                      ok={(m) => setMessage(m)}
                    />
                  ),
                },
              ]}
            />
          ) : null}

          {section === "duties" ? (
            <BranchWorkspace
              tabs={[
                {
                  id: "list",
                  label: "التفويض",
                  icon: <ClipboardList className="size-4" />,
                  node: (
          <section>
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
                  {BRANCH_HEAD_DELEGATABLE_DUTIES.map((d) => (
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
                  ),
                },
              ]}
            />
          ) : null}
        </Fragment>
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

type SectionRefresh = {
  branchId: string;
  onChanged: () => Promise<void>;
  fail?: (err: unknown) => void;
  ok?: (msg: string) => void;
};

type SectionCallback = {
  onChanged: () => Promise<void>;
  ok?: (msg: string) => void;
};

const WARNING_KINDS = [
  { code: "absence", ar: "غياب" },
  { code: "behavior", ar: "سلوك" },
  { code: "academic", ar: "دراسي" },
] as const;

const ATTENDANCE_STATUSES = [
  { code: "present", ar: "حاضر" },
  { code: "late", ar: "متأخر" },
  { code: "absent", ar: "غائب" },
] as const;


function TeachersSection({
  teachers,
  classes,
  onChanged,
  ok,
}: SectionCallback & { teachers: BranchTeacher[]; classes: BranchClass[] }) {
  const notifyOk = ok ?? (() => undefined);
  const [workloadTeacherId, setWorkloadTeacherId] = useState("");
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [formSubjectIds, setFormSubjectIds] = useState<string[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const activeTeacherId = workloadTeacherId || teachers[0]?.teacherUserId || "";

  useEffect(() => {
    let cancelled = false;
    getAcademicYears()
      .then((list) => {
        if (!cancelled) setYears(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeTeacherId) {
      setAssignments([]);
      return;
    }
    let cancelled = false;
    setAssignmentsLoading(true);
    getTeacherAssignments(activeTeacherId)
      .then((list) => {
        if (!cancelled) setAssignments(list.filter((a) => teachers.some((t) => t.teacherUserId === a.teacherUserId)));
      })
      .catch(() => {
        if (!cancelled) setAssignments([]);
      })
      .finally(() => {
        if (!cancelled) setAssignmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTeacherId, teachers]);

  useEffect(() => {
    if (!formClassId) {
      setSubjects([]);
      setFormSubjectIds([]);
      return;
    }
    let cancelled = false;
    getClassSubjects(formClassId)
      .then((list) => {
        if (!cancelled) {
          setSubjects(list.filter((s) => s.active));
          setFormSubjectIds([]);
        }
      })
      .catch(() => {
        if (!cancelled) setSubjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [formClassId]);

  async function submitAssign(e: FormEvent) {
    e.preventDefault();
    const year = years.find((y) => y.isCurrent) ?? years[0];
    if (!formTeacherId || !formClassId || formSubjectIds.length === 0 || !year) {
      setError("اختر المعلم والفصل ومادة واحدة على الأقل (يلزم وجود سنة دراسية)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let createdCount = 0;
      let skippedCount = 0;
      for (const subjectId of formSubjectIds) {
        try {
          await addTeachingAssignment({
            teacherUserId: formTeacherId,
            classId: formClassId,
            subjectId,
            academicYearId: year.id,
          });
          createdCount += 1;
        } catch (itemErr) {
          // Re-submitting an already-assigned subject is not a failure:
          // keep it, continue with the rest, and report it as skipped.
          if (itemErr instanceof Error && itemErr.message.includes("بالفعل")) {
            skippedCount += 1;
            continue;
          }
          throw itemErr;
        }
      }
      const pickedTeacher = formTeacherId;
      setFormTeacherId("");
      setFormClassId("");
      setFormSubjectIds([]);
      setWorkloadTeacherId(pickedTeacher);
      notifyOk(
        createdCount > 0
          ? `تم إسناد ${createdCount} ${createdCount === 1 ? "مادة" : "مواد"}` + (skippedCount > 0 ? ` (${skippedCount} مسندة مسبقًا)` : "")
          : "جميع المواد المختارة مسندة مسبقًا لهذا المعلم",
      );
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إسناد مهمة التدريس");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setRemoveId(null);
    setBusy(true);
    setError("");
    try {
      await removeTeachingAssignment(id);
      notifyOk("تم إلغاء مهمة التدريس");
      await onChanged();
      if (activeTeacherId) setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إلغاء مهمة التدريس");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <GraduationCap className="size-4 text-gold" />
        المعلمون ومهام التدريس ({teachers.length})
      </h3>
      <p className="mt-1 text-xs text-navy/55">
        إسناد المعلمين (الملحقين بفرعك) إلى الفصول والمواد — دون إلحاق أو فصل من الفرع نفسه.
      </p>
      {teachers.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا يوجد معلمون ملحقون بفرعك بعد — الإلحاق من صلاحيات المدير العام.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <label className={labelCls}>عبء التدريس لـ</label>
            <select className={selectCls} value={activeTeacherId} onChange={(e) => setWorkloadTeacherId(e.target.value)}>
              {teachers.map((t) => (
                <option key={t.teacherUserId} value={t.teacherUserId}>
                  {t.userNameAr ?? t.teacherUserId}
                </option>
              ))}
            </select>
          </div>
          {assignmentsLoading ? (
            <p className="mt-3 text-center text-sm text-navy/55">جارٍ تحميل المهام…</p>
          ) : assignments.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
              لا توجد مهام تدريس مسندة لهذا المعلم بعد.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-navy/10 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">
                      {a.classNameAr ?? a.classId} · {a.subjectCode ?? a.subjectId}
                    </p>
                    <p className="truncate text-xs text-navy/55">{a.yearLabel ?? ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoveId(a.id)}
                    aria-label="إلغاء مهمة التدريس"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={submitAssign} className="mt-3 rounded-xl bg-cream-subtle p-3">
            <p className="mb-2 text-sm font-bold text-navy">إسناد مهمة تدريس</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select aria-label="المعلم" className={selectCls} value={formTeacherId} onChange={(e) => setFormTeacherId(e.target.value)}>
                <option value="">اختر معلمًا…</option>
                {teachers.map((t) => (
                  <option key={t.teacherUserId} value={t.teacherUserId}>
                    {t.userNameAr ?? t.teacherUserId}
                  </option>
                ))}
              </select>
              <select aria-label="الفصل" className={selectCls} value={formClassId} onChange={(e) => setFormClassId(e.target.value)}>
                <option value="">اختر فصلًا…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 rounded-xl border border-navy/10 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-navy">
                  المواد {formSubjectIds.length > 0 ? `(${formSubjectIds.length} مختارة)` : ""}
                </p>
                {formClassId && subjects.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFormSubjectIds((prev) =>
                        prev.length === subjects.length ? [] : subjects.map((s) => s.subjectId),
                      )
                    }
                    className="text-xs font-bold text-navy/60 underline underline-offset-4 hover:text-gold"
                  >
                    {formSubjectIds.length === subjects.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                  </button>
                ) : null}
              </div>
              {!formClassId ? (
                <p className="text-xs text-navy/55">اختر الفصل أولًا لعرض مواده…</p>
              ) : subjects.length === 0 ? (
                <p className="text-xs text-navy/55">لا توجد مواد مربوطة بهذا الفصل بعد — اربط المواد من تبويب المواد أولًا.</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {subjects.map((s) => {
                    const checked = formSubjectIds.includes(s.subjectId);
                    return (
                      <label
                        key={s.subjectId}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-navy/10 px-3 py-2 text-sm text-navy transition-colors has-checked:border-gold has-checked:bg-gold/10"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setFormSubjectIds((prev) =>
                              e.target.checked ? [...prev, s.subjectId] : prev.filter((id) => id !== s.subjectId),
                            )
                          }
                          className="size-4 shrink-0 accent-gold"
                        />
                        <span className="min-w-0 truncate font-semibold">
                          {s.subjectNameAr ?? s.subjectId}
                          <span className="font-normal text-navy/55"> (معامل {s.coefficient})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
            >
              <Plus className="size-4" />
              إسناد
            </button>
          </form>
        </>
      )}
      <ConfirmDialog
        open={removeId !== null}
        title="تأكيد إلغاء مهمة التدريس"
        description="هل أنت متأكد من إلغاء هذه المهمة؟ سيتوقف احتسابها ضمن عبء المعلم."
        confirmLabel="نعم، إلغاء"
        cancelLabel="تراجع"
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveId(null)}
      />
    </section>
  );
}

function AttendanceManage({
  classes,
  students,
  onChanged,
  ok,
}: SectionCallback & { classes: BranchClass[]; students: BranchStudent[] }) {
  const notifyOk = ok ?? (() => undefined);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [marks, setMarks] = useState<AttendanceEntry[]>([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [markStudentId, setMarkStudentId] = useState("");
  const [markStatus, setMarkStatus] = useState("present");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activeClassId = classId || classes[0]?.id || "";

  async function loadMarks(cid: string, d: string) {
    if (!cid) {
      setMarks([]);
      return;
    }
    setMarksLoading(true);
    try {
      setMarks(await getClassAttendance(cid, d));
    } catch {
      setMarks([]);
    } finally {
      setMarksLoading(false);
    }
  }

  useEffect(() => {
    void loadMarks(activeClassId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassId, date, classes]);

  const classStudents = useMemo(() => {
    if (!activeClassId) return [];
    const enrolled = students.filter((s) => s.classId === activeClassId);
    return enrolled.length > 0 ? enrolled : students;
  }, [students, activeClassId]);

  async function submitMark(e: FormEvent) {
    e.preventDefault();
    if (!activeClassId || !markStudentId) {
      setError("اختر الفصل والطالب");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await markBranchAttendance({ classId: activeClassId, studentId: markStudentId, date, status: markStatus });
      setMarkStudentId("");
      await loadMarks(activeClassId, date);
      notifyOk("تم تسجيل الحضور");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الحضور");
    } finally {
      setBusy(false);
    }
  }

  async function removeMark(id: string) {
    setBusy(true);
    setError("");
    try {
      await removeBranchAttendance(id);
      await loadMarks(activeClassId, date);
      notifyOk("تم حذف التسجيل");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف التسجيل");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <CalendarCheck2 className="size-4 text-gold" />
        تسجيل الحضور وتصحيحه
      </h3>
      <p className="mt-1 text-xs text-navy/55">رصد حضور فصول فرعك وتصحيحه — التسجيل المكرر لنفس الطالب والتاريخ يُحدَّث تلقائيًا.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select aria-label="الفصل" className={selectCls} value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
        <input aria-label="التاريخ" className={selectCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {marksLoading ? (
        <p className="mt-3 text-center text-sm text-navy/55">جارٍ تحميل التسجيلات…</p>
      ) : marks.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا توجد تسجيلات حضور لهذا الفصل في هذا التاريخ.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {marks.map((m) => (
            <li key={m.id ?? `${m.studentId}-${m.date}`} className="flex items-center justify-between gap-2 rounded-xl border border-navy/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{m.studentNameAr}</p>
                <p className="text-xs text-navy/55">
                  {m.status === "present" ? "حاضر" : m.status === "late" ? "متأخر" : "غائب"}
                </p>
              </div>
              {m.id ? (
                <button
                  type="button"
                  onClick={() => void removeMark(m.id as string)}
                  aria-label={`حذف تسجيل ${m.studentNameAr}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/10"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submitMark} className="mt-3 rounded-xl bg-cream-subtle p-3">
        <p className="mb-2 text-sm font-bold text-navy">رصد / تصحيح</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="الطالب" className={selectCls} value={markStudentId} onChange={(e) => setMarkStudentId(e.target.value)}>
            <option value="">اختر طالبًا…</option>
            {classStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
          <select aria-label="الحالة" className={selectCls} value={markStatus} onChange={(e) => setMarkStatus(e.target.value)}>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.ar}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
        >
          <Plus className="size-4" />
          حفظ التسجيل
        </button>
      </form>
    </section>
  );
}

function WarningsSection({
  branchId,
  students,
  warnings,
  onChanged,
  ok,
}: SectionRefresh & { students: BranchStudent[]; warnings: BranchWarning[] }) {
  const notifyOk = ok ?? (() => undefined);
  const [warnStudentId, setWarnStudentId] = useState("");
  const [warnKind, setWarnKind] = useState("absence");
  const [warnDate, setWarnDate] = useState(todayIso());
  const [warnBody, setWarnBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!warnStudentId || !warnDate) {
      setError("اختر الطالب والتاريخ");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addBranchWarning({ studentId: warnStudentId, branchId, kind: warnKind, date: warnDate, body: warnBody.trim() || undefined });
      setWarnStudentId("");
      setWarnBody("");
      notifyOk("تم إصدار التنبيه");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إصدار التنبيه");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setRemoveId(null);
    setBusy(true);
    setError("");
    try {
      await removeBranchWarning(id);
      notifyOk("تم حذف التنبيه");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف التنبيه");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <ClipboardList className="size-4 text-gold" />
        التنبيهات ({warnings.length})
      </h3>
      {warnings.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا توجد تنبيهات في فرعك.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {warnings.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2 rounded-xl border border-navy/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{w.studentNameAr}</p>
                <p className="truncate text-xs text-navy/55">
                  {WARNING_KINDS.find((k) => k.code === w.kind)?.ar ?? w.kind} · {w.date}
                  {w.body ? ` · ${w.body}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRemoveId(w.id)}
                aria-label="حذف التنبيه"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/10"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 rounded-xl bg-cream-subtle p-3">
        <p className="mb-2 text-sm font-bold text-navy">إصدار تنبيه</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="الطالب" className={selectCls} value={warnStudentId} onChange={(e) => setWarnStudentId(e.target.value)}>
            <option value="">اختر طالبًا…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
          <select aria-label="النوع" className={selectCls} value={warnKind} onChange={(e) => setWarnKind(e.target.value)}>
            {WARNING_KINDS.map((k) => (
              <option key={k.code} value={k.code}>
                {k.ar}
              </option>
            ))}
          </select>
        </div>
        <input aria-label="التاريخ" className={cn(selectCls, "mt-2")} type="date" value={warnDate} onChange={(e) => setWarnDate(e.target.value)} />
        <input aria-label="البيان" className={cn(selectCls, "mt-2")} value={warnBody} onChange={(e) => setWarnBody(e.target.value)} placeholder="بيان التنبيه (اختياري)…" />
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
        >
          <Plus className="size-4" />
          إصدار
        </button>
      </form>
      <ConfirmDialog
        open={removeId !== null}
        title="تأكيد حذف التنبيه"
        description="هل أنت متأكد من حذف هذا التنبيه؟"
        confirmLabel="نعم، حذف"
        cancelLabel="تراجع"
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveId(null)}
      />
    </section>
  );
}

const WEEK_DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function ClassesSection({
  branchId,
  classes,
  onChanged,
  ok,
}: SectionRefresh & { classes: BranchClass[] }) {
  const notifyOk = ok ?? (() => undefined);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [target, setTarget] = useState<BranchClass | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [form, setForm] = useState({ nameAr: "", nameFr: "", level: "", section: "", capacity: "", active: true });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAcademicYears()
      .then((list) => {
        if (!cancelled) setYears(list.filter((y) => y.active));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];

  function openCreate() {
    setTarget(null);
    setForm({ nameAr: "", nameFr: "", level: "", section: "", capacity: "", active: true });
    setFormError("");
    setModal("create");
  }

  function openEdit(c: BranchClass) {
    setTarget(c);
    setForm({
      nameAr: c.nameAr,
      nameFr: c.nameFr ?? "",
      level: c.level ?? "",
      section: c.section ?? "",
      capacity: c.capacity !== null && c.capacity !== undefined ? String(c.capacity) : "",
      active: c.active ?? true,
    });
    setFormError("");
    setModal("edit");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      setFormError("يرجى إدخال اسم الفصل");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const capacity = form.capacity.trim() === "" ? undefined : Number(form.capacity);
      if (modal === "create") {
        if (!currentYear) throw new Error("لا توجد سنة دراسية متاحة");
        await createBranchClass(branchId, {
          academicYearId: currentYear.id,
          nameAr: form.nameAr.trim(),
          nameFr: form.nameFr.trim() || undefined,
          level: form.level.trim() || undefined,
          section: form.section.trim() || undefined,
          capacity: Number.isFinite(capacity) ? capacity : undefined,
        });
        notifyOk("تم إنشاء الفصل بنجاح");
      } else if (target) {
        await updateBranchClass(target.id, {
          nameAr: form.nameAr.trim(),
          nameFr: form.nameFr.trim() || undefined,
          level: form.level.trim() || undefined,
          section: form.section.trim() || undefined,
          capacity: Number.isFinite(capacity) ? capacity : undefined,
          active: form.active,
        });
        notifyOk("تم حفظ بيانات الفصل");
      }
      setModal(null);
      await onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "تعذر حفظ الفصل");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-navy">
          <BookOpen className="size-4 text-gold" />
          الفصول ({classes.length})
        </h3>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-gold"
        >
          <Plus className="size-4" />
          فصل جديد
        </button>
      </div>
      {classes.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا توجد فصول في فرعك بعد.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-navy/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">
                  {c.nameAr} {c.active === false ? <Badge tone="muted">مغلق</Badge> : null}
                </p>
                <p className="truncate text-xs text-navy/55">
                  {[c.level, c.section].filter(Boolean).join(" · ") || "—"}
                  {c.headTeacherNameAr ? ` · المعلم المسؤول: ${c.headTeacherNameAr}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(c)}
                aria-label={`تعديل ${c.nameAr}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-navy hover:bg-cream"
              >
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {modal ? (
        <Modal open={Boolean(modal)} onClose={() => setModal(null)} size="md">
          <ModalHeader>
            <h3 className="font-display text-xl font-bold text-navy">{modal === "create" ? "إنشاء فصل" : "تعديل الفصل"}</h3>
            <p className="mt-1 text-xs text-navy/55">
              {modal === "create" ? `سيُنشأ الفصل في فرعك للسنة ${currentYear?.label ?? "الحالية"}.` : "تعديل بيانات الفصل."}
            </p>
          </ModalHeader>
          <ModalContent>
            <form id="class-form" onSubmit={submit} className="space-y-4">
              <div>
                <label className={labelCls}>اسم الفصل *</label>
                <input className={inputCls} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>المستوى</label>
                  <input className={inputCls} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>الشعبة</label>
                  <input className={inputCls} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>الاسم بالفرنسية</label>
                  <input className={inputCls} value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>السعة</label>
                  <input className={inputCls} dir="ltr" type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </div>
              </div>
              {modal === "edit" ? (
                <label className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  الفصل نشط
                </label>
              ) : null}
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            </form>
          </ModalContent>
          <ModalFooter>
            <button
              type="button"
              className="min-h-11 rounded-full border border-navy/15 px-5 py-2.5 text-sm text-navy hover:bg-cream"
              onClick={() => setModal(null)}
            >
              إلغاء
            </button>
            <button
              type="submit"
              form="class-form"
              disabled={saving}
              className="min-h-11 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </ModalFooter>
        </Modal>
      ) : null}
    </section>
  );
}

function ClassSubjectsSection({
  classes,
  onChanged,
  ok,
}: SectionCallback & { classes: BranchClass[] }) {
  const notifyOk = ok ?? (() => undefined);
  const [classId, setClassId] = useState("");
  const [attached, setAttached] = useState<ClassSubject[]>([]);
  const [catalog, setCatalog] = useState<CatalogSubject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [coefficient, setCoefficient] = useState("1");
  const [maxScore, setMaxScore] = useState("20");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ClassSubject | null>(null);

  const activeClassId = classId || classes[0]?.id || "";

  useEffect(() => {
    let cancelled = false;
    getSubjectsCatalog()
      .then((list) => {
        if (!cancelled) setCatalog(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeClassId) {
      setAttached([]);
      return;
    }
    let cancelled = false;
    getClassSubjects(activeClassId)
      .then((list) => {
        if (!cancelled) setAttached(list);
      })
      .catch(() => {
        if (!cancelled) setAttached([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClassId, classes]);

  async function reload() {
    if (!activeClassId) return;
    setAttached(await getClassSubjects(activeClassId));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activeClassId || !subjectId) {
      setError("اختر الفصل والمادة");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const coef = Number(coefficient);
      const max = Number(maxScore);
      await attachClassSubject(activeClassId, {
        subjectId,
        coefficient: Number.isFinite(coef) && coef > 0 ? coef : 1,
        maxScore: Number.isFinite(max) && max > 0 ? max : 20,
      });
      setSubjectId("");
      notifyOk("تم ربط المادة بالفصل");
      await reload();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر ربط المادة");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDetach() {
    if (!removeTarget || !activeClassId) return;
    const t = removeTarget;
    setRemoveTarget(null);
    setBusy(true);
    setError("");
    try {
      await detachClassSubject(activeClassId, t.subjectId);
      notifyOk("تم فصل المادة عن الفصل");
      await reload();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر فصل المادة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <BookOpen className="size-4 text-gold" />
        مواد الفصول
      </h3>
      <p className="mt-1 text-xs text-navy/55">ربط مواد الكتالوج العام بفصول فرعك — دون تعديل الكتالوج نفسه.</p>
      <select aria-label="الفصل" className={cn(selectCls, "mt-3")} value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nameAr}
          </option>
        ))}
      </select>
      {attached.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا توجد مواد مربوطة بهذا الفصل بعد.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {attached.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-navy/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{s.subjectNameAr ?? s.subjectId}</p>
                <p className="text-xs text-navy/55">معامل {s.coefficient} · الدرجة {s.maxScore}</p>
              </div>
              <button
                type="button"
                onClick={() => setRemoveTarget(s)}
                aria-label="فصل المادة"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/10"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 rounded-xl bg-cream-subtle p-3">
        <p className="mb-2 text-sm font-bold text-navy">ربط مادة</p>
        <select aria-label="المادة" className={selectCls} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">اختر مادة من الكتالوج…</option>
          {catalog.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameAr} ({s.code})
            </option>
          ))}
        </select>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input aria-label="المعامل" className={selectCls} dir="ltr" type="number" min={0.5} step={0.5} value={coefficient} onChange={(e) => setCoefficient(e.target.value)} />
          <input aria-label="الدرجة العظمى" className={selectCls} dir="ltr" type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
        >
          <Plus className="size-4" />
          ربط
        </button>
      </form>
      <ConfirmDialog
        open={removeTarget !== null}
        title="تأكيد فصل المادة"
        description="هل أنت متأكد من فصل هذه المادة عن الفصل؟"
        confirmLabel="نعم، فصل"
        cancelLabel="تراجع"
        onConfirm={() => void confirmDetach()}
        onCancel={() => setRemoveTarget(null)}
      />
    </section>
  );
}

function TimetableSection({
  classes,
  onChanged,
  ok,
}: SectionCallback & { classes: BranchClass[] }) {
  const notifyOk = ok ?? (() => undefined);
  const [classId, setClassId] = useState("");
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [day, setDay] = useState("0");
  // Slots are 0-based across every UI (portals match day/slot indexes);
  // the label shows الحصة N+1 to match the shared SLOTS convention.
  const [slot, setSlot] = useState("0");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TimetableSlot | null>(null);

  const activeClassId = classId || classes[0]?.id || "";
  const subjectName = (id: string) => subjects.find((s) => s.subjectId === id)?.subjectNameAr ?? id;

  async function reload(cid: string) {
    const [tt, cs] = await Promise.all([getClassTimetable(cid), getClassSubjects(cid).catch(() => [] as ClassSubject[])]);
    setSlots(tt);
    setSubjects(cs.filter((s) => s.active));
  }

  useEffect(() => {
    if (!activeClassId) {
      setSlots([]);
      setSubjects([]);
      return;
    }
    let cancelled = false;
    reload(activeClassId).catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassId, classes]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activeClassId || !subjectId) {
      setError("اختر الفصل والمادة");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await upsertTimetableSlot(activeClassId, { day: Number(day), slot: Number(slot), subjectId });
      notifyOk("تم حفظ الحصة");
      await reload(activeClassId);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الحصة");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget || !activeClassId) return;
    const t = removeTarget;
    setRemoveTarget(null);
    setBusy(true);
    setError("");
    try {
      await removeTimetableSlot(activeClassId, t.id);
      notifyOk("تم حذف الحصة");
      await reload(activeClassId);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف الحصة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <CalendarCheck2 className="size-4 text-gold" />
        الجدول الدراسي
      </h3>
      <select aria-label="الفصل" className={cn(selectCls, "mt-3")} value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nameAr}
          </option>
        ))}
      </select>
      {slots.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا توجد حصص مسجلة لهذا الفصل بعد.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-navy/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{subjectName(s.subjectId)}</p>
                <p className="text-xs text-navy/55">{WEEK_DAYS[s.day] ?? `يوم ${s.day}`} · الحصة {s.slot}</p>
              </div>
              <button
                type="button"
                onClick={() => setRemoveTarget(s)}
                aria-label="حذف الحصة"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/10"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 rounded-xl bg-cream-subtle p-3">
        <p className="mb-2 text-sm font-bold text-navy">إضافة / تعديل حصة (نفس اليوم والحصة يُحدَّث)</p>
        <div className="grid grid-cols-3 gap-2">
          <select aria-label="اليوم" className={selectCls} value={day} onChange={(e) => setDay(e.target.value)}>
            {WEEK_DAYS.map((d, i) => (
              <option key={d} value={String(i)}>
                {d}
              </option>
            ))}
          </select>
          <select aria-label="الحصة" className={selectCls} value={slot} onChange={(e) => setSlot(e.target.value)}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                الحصة {n + 1}
              </option>
            ))}
          </select>
          <select aria-label="المادة" className={selectCls} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">المادة…</option>
            {subjects.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.subjectNameAr ?? s.subjectId}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
        >
          <Plus className="size-4" />
          حفظ الحصة
        </button>
      </form>
      <ConfirmDialog
        open={removeTarget !== null}
        title="تأكيد حذف الحصة"
        description="هل أنت متأكد من حذف هذه الحصة من الجدول؟"
        confirmLabel="نعم، حذف"
        cancelLabel="تراجع"
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </section>
  );
}

function ExamsSection({
  branchId,
  onChanged,
  ok,
}: SectionRefresh) {
  const notifyOk = ok ?? (() => undefined);
  const [exams, setExams] = useState<ExamSession[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [es, ts] = await Promise.all([
      getBranchExamSessions(branchId),
      getTerms().catch(() => [] as Term[]),
    ]);
    setExams(es);
    setTerms(ts);
    if (!termId && ts.length > 0) setTermId(ts[0].id);
  }

  useEffect(() => {
    reload().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!termId || !name.trim() || !date) {
      setError("اختر الفصل الدراسي وأدخل اسم الامتحان وتاريخه");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createBranchExamSession({ branchId, termId, name: name.trim(), date });
      setName("");
      notifyOk("تم إنشاء الامتحان");
      await reload();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الامتحان");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <CalendarCheck2 className="size-4 text-gold" />
        الامتحانات ({exams.length})
      </h3>
      {exams.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-navy/20 px-3 py-4 text-center text-sm text-navy/55">
          لا توجد امتحانات مجدولة في فرعك بعد.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {exams.map((x) => (
            <li key={x.id} className="rounded-xl border border-navy/10 px-3 py-2.5">
              <p className="truncate text-sm font-bold text-navy">{x.name}</p>
              <p className="truncate text-xs text-navy/55">{x.termNameAr ?? ""} · {x.date}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 rounded-xl bg-cream-subtle p-3">
        <p className="mb-2 text-sm font-bold text-navy">جدولة امتحان</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="الفصل الدراسي" className={selectCls} value={termId} onChange={(e) => setTermId(e.target.value)}>
            <option value="">اختر الفصل الدراسي…</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameAr}
              </option>
            ))}
          </select>
          <input aria-label="التاريخ" className={selectCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <input aria-label="اسم الامتحان" className={cn(selectCls, "mt-2")} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: امتحان الفصل الأول…" />
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-gold disabled:opacity-50 sm:w-auto"
        >
          <Plus className="size-4" />
          جدولة
        </button>
      </form>
    </section>
  );
}

function ResultsSection({
  classes,
  onChanged,
  ok,
}: SectionCallback & { classes: BranchClass[] }) {
  const notifyOk = ok ?? (() => undefined);
  const [classId, setClassId] = useState("");
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState("");
  const [flags, setFlags] = useState<PublishedResult[]>([]);
  const [pending, setPending] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeClassId = classId || classes[0]?.id || "";

  useEffect(() => {
    let cancelled = false;
    getTerms()
      .then((list) => {
        if (!cancelled) {
          setTerms(list);
          if (!termId && list.length > 0) setTermId(list[0].id);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes]);

  useEffect(() => {
    if (!activeClassId) {
      setFlags([]);
      return;
    }
    let cancelled = false;
    getClassPublishedResults(activeClassId)
      .then((list) => {
        if (!cancelled) setFlags(list);
      })
      .catch(() => {
        if (!cancelled) setFlags([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClassId]);

  const activeTermId = termId || terms[0]?.id || "";
  const current = flags.find((f) => f.termId === activeTermId);
  const published = current?.published ?? false;

  async function apply(next: boolean) {
    if (!activeClassId || !activeTermId || busy) return;
    setPending(null);
    setBusy(true);
    setError("");
    try {
      await setClassPublishedResult(activeClassId, activeTermId, next);
      setFlags((prev) => {
        const rest = prev.filter((f) => f.termId !== activeTermId);
        return [...rest, { classId: activeClassId, termId: activeTermId, published: next }];
      });
      notifyOk(next ? "تم نشر النتائج" : "تم إلغاء نشر النتائج");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث حالة النشر");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="flex items-center gap-2 font-bold text-navy">
        <BookOpen className="size-4 text-gold" />
        نشر النتائج
      </h3>
      <p className="mt-1 text-xs text-navy/55">النشر يُظهر الدرجات للطلاب — تأكد قبل النشر أو الإلغاء.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select aria-label="الفصل" className={selectCls} value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
        <select aria-label="الفصل الدراسي" className={selectCls} value={activeTermId} onChange={(e) => setTermId(e.target.value)}>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameAr}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-cream-subtle p-3">
        <Badge tone={published ? "ok" : "muted"}>{published ? "منشورة" : "غير منشورة"}</Badge>
        <button
          type="button"
          disabled={busy || !activeClassId || !activeTermId}
          onClick={() => setPending(!published)}
          className="inline-flex min-h-11 items-center rounded-xl bg-navy px-4 py-2 text-sm font-bold text-gold disabled:opacity-50"
        >
          {published ? "إلغاء النشر" : "نشر النتائج"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <ConfirmDialog
        open={pending !== null}
        title={pending ? "تأكيد نشر النتائج" : "تأكيد إلغاء النشر"}
        description={
          pending
            ? "سيتمكن جميع طلاب هذا الفصل من رؤية درجاتهم. هل أنت متأكد؟"
            : "ستُخفى الدرجات عن الطلاب. هل أنت متأكد؟"
        }
        confirmLabel={pending ? "نعم، انشر" : "نعم، ألغِ النشر"}
        cancelLabel="تراجع"
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next !== null) void apply(next);
        }}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}

function CountTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-cream/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-navy/55">{label}</p>
        <Icon className="size-4 text-gold" strokeWidth={1.75} />
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-navy">{value}</p>
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
    <section>
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
